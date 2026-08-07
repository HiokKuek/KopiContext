/** Settings owned exclusively by the private Node runtime. */
export type PrivateApiConfig = Readonly<{
  host: string;
  port: number;
  serviceCredential: string;
}>;

export function privateApiConfigFromEnvironment(
  environment: NodeJS.ProcessEnv = process.env,
): PrivateApiConfig {
  const rawPort = environment.PRIVATE_API_PORT?.trim() ?? "3001";
  const port = Number(rawPort);
  const serviceCredential = environment.PRIVATE_API_SERVICE_CREDENTIAL?.trim();

  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error("PRIVATE_API_PORT must be an integer between 1 and 65535.");
  }

  if (!serviceCredential) {
    throw new Error("PRIVATE_API_SERVICE_CREDENTIAL must be set before starting the private API.");
  }

  return {
    host: environment.PRIVATE_API_HOST?.trim() || "127.0.0.1",
    port,
    serviceCredential,
  };
}
