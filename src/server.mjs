import { createApplication } from "./application.mjs";
import { createHttpServer } from "./api/server.mjs";

const application = await createApplication();
const server = createHttpServer(application);
server.listen(application.config.port, application.config.host, () => {
  console.log(`PromptHub Studio listening on ${application.config.publicOrigin}`);
  console.log("Runner inbound port: disabled");
});
