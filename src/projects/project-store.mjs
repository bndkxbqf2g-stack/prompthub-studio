import { GitHubApiError } from "../control/github-client.mjs";

const REGISTRY_PATH = ".prompthub/projects.json";

function projectDataPath(projectId) {
  return `.prompthub/project-data/${encodeURIComponent(projectId)}.json`;
}

function parseRegistry(file) {
  if (!file) return { schema: 1, projects: [] };
  try {
    const value = JSON.parse(file.content);
    if (value?.schema !== 1 || !Array.isArray(value.projects)) throw new Error();
    return value;
  } catch {
    throw new Error("project registry is invalid; refusing to overwrite it");
  }
}

function parseProjectData(file) {
  if (!file) return { drafts: [], decisions: [] };
  try {
    const data = JSON.parse(file.content);
    if (data?.schema !== 1 || !Array.isArray(data.drafts) || !Array.isArray(data.decisions)) throw new Error();
    return data;
  } catch {
    throw new Error("project data is invalid; refusing to overwrite it");
  }
}

export class MemoryProjectStore {
  constructor() {
    this.projects = new Map();
    this.data = new Map();
    this.globalData = new Map();
    this.projectDataQueues = new Map();
  }

  async list() { return structuredClone([...this.projects.values()]); }
  async get(id) { return structuredClone(this.projects.get(id) ?? null); }
  async save(project) { this.projects.set(project.id, structuredClone(project)); return structuredClone(project); }
  async getProjectData(id) { return structuredClone(this.data.get(id) ?? { drafts: [], decisions: [] }); }
  async saveProjectData(id, value) { this.data.set(id, structuredClone(value)); }
  async updateProjectData(id, updater) {
    const previous = this.projectDataQueues.get(id) ?? Promise.resolve();
    const operation = previous.catch(() => {}).then(async () => {
      const current = await this.getProjectData(id);
      const next = await updater(current);
      if (!next || typeof next !== "object" || Array.isArray(next)) throw new Error("project data update must return an object");
      await this.saveProjectData(id, next);
      return structuredClone(next);
    });
    this.projectDataQueues.set(id, operation);
    try { return await operation; }
    finally { if (this.projectDataQueues.get(id) === operation) this.projectDataQueues.delete(id); }
  }
  async deleteProjectData(id) { this.data.delete(id); }
  async getGlobalData(name) { return structuredClone(this.globalData.get(name) ?? { schema: 1, entries: [] }); }
  async saveGlobalData(name, value) { this.globalData.set(name, structuredClone(value)); }
}

export class GitHubProjectStore {
  constructor({ client, controlRepository, branch = "main", now = () => new Date() } = {}) {
    this.client = client;
    this.controlRepository = controlRepository;
    this.branch = branch;
    this.now = now;
  }

  async readRegistry() {
    const file = await this.client.getContent(this.controlRepository, REGISTRY_PATH, this.branch);
    return { registry: parseRegistry(file), sha: file?.sha ?? null };
  }

  async list() {
    const { registry } = await this.readRegistry();
    return structuredClone(registry.projects);
  }

  async get(id) {
    const { registry } = await this.readRegistry();
    return structuredClone(registry.projects.find((project) => project.id === id) ?? null);
  }

  async save(project) {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const { registry, sha } = await this.readRegistry();
      const projects = registry.projects.filter((item) => item.id !== project.id);
      projects.push(structuredClone(project));
      try {
        await this.client.putContent(this.controlRepository, REGISTRY_PATH, {
          content: `${JSON.stringify({ schema: 1, updated_at: this.now().toISOString(), projects }, null, 2)}\n`,
          sha,
          branch: this.branch,
          message: `chore(prompthub): update project registry`,
        });
        return structuredClone(project);
      } catch (error) {
        if (!(error instanceof GitHubApiError) || ![409, 422].includes(error.status) || attempt === 2) throw error;
      }
    }
    throw new Error("project registry could not be saved safely");
  }

  async getProjectData(id) {
    const file = await this.client.getContent(this.controlRepository, projectDataPath(id), this.branch);
    return parseProjectData(file);
  }

  async saveProjectData(id, value) {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const file = await this.client.getContent(this.controlRepository, projectDataPath(id), this.branch);
      try {
        await this.client.putContent(this.controlRepository, projectDataPath(id), {
          content: `${JSON.stringify({ ...value, schema: 1, updated_at: this.now().toISOString() }, null, 2)}\n`,
          sha: file?.sha,
          branch: this.branch,
          message: `chore(prompthub): update project data`,
        });
        return;
      } catch (error) {
        if (!(error instanceof GitHubApiError) || ![409, 422].includes(error.status) || attempt === 2) throw error;
      }
    }
    throw new Error("project data could not be saved safely");
  }

  async updateProjectData(id, updater) {
    if (typeof updater !== "function") throw new Error("project data updater is required");
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const file = await this.client.getContent(this.controlRepository, projectDataPath(id), this.branch);
      const current = parseProjectData(file);
      const next = await updater(structuredClone(current));
      if (!next || typeof next !== "object" || Array.isArray(next)) throw new Error("project data update must return an object");
      try {
        await this.client.putContent(this.controlRepository, projectDataPath(id), {
          content: `${JSON.stringify({ ...next, schema: 1, updated_at: this.now().toISOString() }, null, 2)}\n`,
          sha: file?.sha,
          branch: this.branch,
          message: "chore(prompthub): update project knowledge",
        });
        return structuredClone(next);
      } catch (error) {
        if (!(error instanceof GitHubApiError) || ![409, 422].includes(error.status) || attempt === 2) throw error;
      }
    }
    throw new Error("project data update could not be saved safely");
  }

  async deleteProjectData(id) {
    const path = projectDataPath(id);
    const file = await this.client.getContent(this.controlRepository, path, this.branch);
    if (!file) return;
    await this.client.deleteContent(this.controlRepository, path, {
      sha: file.sha,
      branch: this.branch,
      message: "chore(prompthub): remove active project data",
    });
  }

  async getGlobalData(name) {
    if (name !== "prompt-library-reviews") throw new Error("unknown global data collection");
    const file = await this.client.getContent(this.controlRepository, `.prompthub/${name}.json`, this.branch);
    if (!file) return { schema: 1, entries: [] };
    try {
      const data = JSON.parse(file.content);
      if (data?.schema !== 1 || !Array.isArray(data.entries)) throw new Error();
      return data;
    } catch {
      throw new Error("global project data is invalid; refusing to overwrite it");
    }
  }

  async saveGlobalData(name, value) {
    if (name !== "prompt-library-reviews") throw new Error("unknown global data collection");
    const path = `.prompthub/${name}.json`;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const file = await this.client.getContent(this.controlRepository, path, this.branch);
      try {
        await this.client.putContent(this.controlRepository, path, {
          content: `${JSON.stringify(value, null, 2)}\n`,
          sha: file?.sha,
          branch: this.branch,
          message: "chore(prompthub): version prompt library review",
        });
        return;
      } catch (error) {
        if (!(error instanceof GitHubApiError) || ![409, 422].includes(error.status) || attempt === 2) throw error;
      }
    }
    throw new Error("global project data could not be saved safely");
  }
}
