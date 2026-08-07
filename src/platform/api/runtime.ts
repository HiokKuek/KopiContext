import { buildPrivateApi } from "./app";
import { privateApiConfigFromEnvironment } from "./config";
import { serviceCredentialAuthenticator } from "./service-auth";

const configuration = privateApiConfigFromEnvironment();
const app = buildPrivateApi({
  serviceAuthenticator: serviceCredentialAuthenticator(configuration.serviceCredential),
});

const shutdown = async () => {
  await app.close();
};

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);

try {
  await app.listen({ host: configuration.host, port: configuration.port });
} catch (error) {
  await app.close();
  throw error;
}
