import process from "node:process";
import { readConfig } from "./config.mjs";
import { createControlPlane, createGitHubClient } from "./control/index.mjs";
import { GitHubProjectStore } from "./projects/project-store.mjs";
import { ProjectService } from "./projects/project-service.mjs";
import { ErrorLearningEngine } from "./knowledge/error-learning.mjs";
import { StrategyLearningEngine } from "./knowledge/strategy-learning.mjs";
import { PromptDesigner } from "./designer/prompt-designer.mjs";
import { loadPromptLibrary } from "./research/load-prompt-library.mjs";
import { LocalAuth, GitHubOAuth } from "./auth/github-oauth.mjs";
import { createRequestHandler } from "./api/handler.mjs";

export async function createApplication({
  env = process.env,
  fetchImpl = globalThis.fetch,
  sessionStore,
  stateStore,
  jobAdmissionGate = null,
  enforceSameOrigin = env.NODE_ENV === "production",
  logger = console,
} = {}) {
  const config = readConfig(env);
  const githubClient = config.mode === "github" ? createGitHubClient(config, { fetchImpl }) : null;
  const controlPlane = createControlPlane(config, { ...(githubClient ? { githubClient } : {}), fetchImpl });
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
  const strategyLearning = projectService ? new StrategyLearningEngine({ projectService }) : null;
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
        fetchImpl,
        store: sessionStore,
        stateStore,
      })
    : new LocalAuth({ production: config.nodeEnv === "production" });
  const handler = createRequestHandler({
    config,
    controlPlane,
    auth,
    projectService,
    promptDesigner,
    promptLibrary,
    errorLearning,
    strategyLearning,
    logger,
    enforceSameOrigin,
    jobAdmissionGate,
  });

  return { config, controlPlane, auth, projectService, promptDesigner, promptLibrary, errorLearning, strategyLearning, handler };
}
