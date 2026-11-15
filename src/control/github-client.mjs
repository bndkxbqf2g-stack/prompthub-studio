import { decodeBase64, encodeBase64 } from "../security/web-crypto.mjs";

export class GitHubApiError extends Error {
  constructor(status, message, details = null) {
    super(message);
    this.name = "GitHubApiError";
    this.status = status;
    this.details = details;
  }
}

function encodePath(path) {
  return path.split("/").map((part) => encodeURIComponent(part)).join("/");
}

export class GitHubClient {
  constructor({ token, apiUrl = "https://api.github.com", fetchImpl = globalThis.fetch } = {}) {
    if (!token) throw new Error("GitHub token is required");
    if (typeof fetchImpl !== "function") throw new Error("fetch implementation is required");
    this.token = token;
    this.apiUrl = apiUrl.replace(/\/$/, "");
    this.fetchImpl = fetchImpl;
  }

  async request(path, { method = "GET", body, headers = {}, signal } = {}) {
    const response = await this.fetchImpl(`${this.apiUrl}${path}`, {
      method,
      signal,
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${this.token}`,
        "X-GitHub-Api-Version": "2022-11-28",
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        ...headers,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const text = await response.text();
    let payload = null;
    if (text) {
      try {
        payload = JSON.parse(text);
      } catch {
        payload = { message: text.slice(0, 500) };
      }
    }
    if (!response.ok) {
      throw new GitHubApiError(response.status, payload?.message ?? `GitHub API returned ${response.status}`, payload);
    }
    return payload;
  }

  getRepository(repository) {
    return this.request(`/repos/${repository}`);
  }

  getUser() {
    return this.request("/user");
  }

  exchangeOAuthCode({ clientId, clientSecret, code, oauthUrl = "https://github.com/login/oauth/access_token" }) {
    return this.fetchImpl(oauthUrl, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code }),
    }).then(async (response) => {
      const payload = await response.json();
      if (!response.ok || payload.error || !payload.access_token) {
        throw new GitHubApiError(response.status, payload.error_description ?? "GitHub OAuth exchange failed", payload);
      }
      return payload;
    });
  }

  async listIssues(repository, { state = "open", labels, perPage = 100 } = {}) {
    const params = new URLSearchParams({ state, per_page: String(perPage), direction: "desc", sort: "created" });
    if (labels) params.set("labels", labels);
    return this.request(`/repos/${repository}/issues?${params}`);
  }

  listContents(repository, path, branch) {
    const ref = branch ? `?ref=${encodeURIComponent(branch)}` : "";
    return this.request(`/repos/${repository}/contents/${encodePath(path)}${ref}`);
  }

  listWorkflowRuns(repository, perPage = 5) {
    return this.request(`/repos/${repository}/actions/runs?per_page=${perPage}`);
  }

  listWorkflowRunJobs(repository, runId, perPage = 100) {
    if (!Number.isSafeInteger(runId) || runId < 1) throw new Error("workflow run ID is invalid");
    if (!Number.isInteger(perPage) || perPage < 1 || perPage > 100) throw new Error("workflow job page size must be between 1 and 100");
    return this.request(`/repos/${repository}/actions/runs/${runId}/jobs?per_page=${perPage}`);
  }

  createIssue(repository, payload) {
    return this.request(`/repos/${repository}/issues`, { method: "POST", body: payload });
  }

  updateIssue(repository, issueNumber, payload) {
    return this.request(`/repos/${repository}/issues/${issueNumber}`, { method: "PATCH", body: payload });
  }

  listIssueComments(repository, issueNumber) {
    return this.request(`/repos/${repository}/issues/${issueNumber}/comments?per_page=100`);
  }

  createIssueComment(repository, issueNumber, body) {
    return this.request(`/repos/${repository}/issues/${issueNumber}/comments`, { method: "POST", body: { body } });
  }

  async listLabels(repository) {
    return this.request(`/repos/${repository}/labels?per_page=100`);
  }

  createLabel(repository, { name, color = "1f6feb", description = "PromptHub Studio status" }) {
    return this.request(`/repos/${repository}/labels`, { method: "POST", body: { name, color, description } });
  }

  async getContent(repository, path, branch) {
    try {
      const result = await this.request(`/repos/${repository}/contents/${encodePath(path)}?ref=${encodeURIComponent(branch)}`);
      if (!result || Array.isArray(result) || result.type !== "file") throw new Error(`GitHub content is not a file: ${path}`);
      const content = decodeBase64((result.content ?? "").replace(/\s/g, ""));
      return { content, sha: result.sha, path: result.path };
    } catch (error) {
      if (error instanceof GitHubApiError && error.status === 404) return null;
      throw error;
    }
  }

  putContent(repository, path, { content, sha, branch, message }) {
    return this.request(`/repos/${repository}/contents/${encodePath(path)}`, {
      method: "PUT",
      body: {
        message,
        content: encodeBase64(content),
        branch,
        ...(sha ? { sha } : {}),
      },
    });
  }

  deleteContent(repository, path, { sha, branch, message }) {
    return this.request(`/repos/${repository}/contents/${encodePath(path)}`, {
      method: "DELETE",
      body: { message, sha, branch },
    });
  }
}
