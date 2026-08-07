import { privateApiRuntimeConfigFromEnvironment } from "./config";
import { composePrivateApiRuntime } from "./runtime-composition";

const configuration = privateApiRuntimeConfigFromEnvironment();
const runtime = composePrivateApiRuntime(configuration);

const shutdown = async () => {
  await runtime.close();
};

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);

try {
  await runtime.app.listen({ host: configuration.host, port: configuration.port });
} catch (error) {
  await runtime.close();
  throw error;
}
