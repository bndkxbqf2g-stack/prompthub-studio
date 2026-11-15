import { readConfig } from "./config.mjs";
import { createControlPlane, createGitHubClient } from "./control/index.mjs";
import { GitHubProjectStore } from "./projects/project-store.mjs";
import { ProjectService } from "./projects/project-service.mjs";
import { ErrorLearningEngine } from "./knowledge/error-learning.mjs";
import { PromptDesigner } from "./designer/prompt-designer.mjs";
import { loadPromptLibrary } from "./research/load-prompt-library.mjs";
import { LocalAuth, GitHubOAuth } from "./auth/github-oauth.mjs";
import { createHttpServer } from "./api/server.mjs";

const config = readConfig();
const githubClient = config.mode === "github" ? createGitHubClient(config) : null;
const controlPlane = createControlPlane(config, githubClient ? { githubClient } : {});
if (typeof controlPlane.assertRepositorySafety === "function") await controlPlane.assertRepositorySafety();
const projectService = githubClient
  ? new ProjectService({
      store: new GitHubProjectStore({ client: githubClient, controlRepository: config.github.repository, branch: config.github.branch }),
      client: githubClient,
      controlPlane,
      controlRepository: config.github.repository,
    })
  : null;
const promptLibrary = await loadPromptLibrary();
const errorLearning = projectService ? new ErrorLearningEngine({ projectService }) : null;
const promptDesigner = projectService ? new PromptDesigner({ projectService, controlPlane, promptLibrary, errorLearning }) : null;
const auth = config.authMode === "github"
  ? new GitHubOAuth({
      clientId: config.github.clientId,
      clientSecret: config.github.clientSecret,
      scopes: config.github.oauthScopes,
      publicOrigin: config.publicOrigin,
      sessionSecret: config.sessionSecret,
      allowedLogins: config.github.allowedLogins,
      production: config.nodeEnv === "production",
    })
  : new LocalAuth({ production: config.nodeEnv === "production" });
const server = createHttpServer({ config, controlPlane, auth, projectService, promptDesigner, promptLibrary, errorLearning });
server.listen(config.port, config.host, () => {
  console.log(`PromptHub Studio listening on ${config.publicOrigin}`);
  console.log("Runner inbound port: disabled");
});
