import { timingSafeEqual } from "node:crypto";

/**
 * Authentication is an adapter concern. Application modules receive the
 * identity that this port returns; they never inspect HTTP headers themselves.
 */
export type PrivateServiceIdentity = Readonly<{
  kind: "private-service";
}>;

export type ServiceCredentialAuthenticator = Readonly<{
  authenticate(authorization: string | undefined): Promise<PrivateServiceIdentity | null>;
}>;

export function serviceCredentialAuthenticator(
  expectedCredential: string,
): ServiceCredentialAuthenticator {
  if (!expectedCredential.trim()) {
    throw new Error("PRIVATE_API_SERVICE_CREDENTIAL must not be empty.");
  }

  const expectedAuthorization = `Bearer ${expectedCredential}`;

  return {
    async authenticate(authorization) {
      if (!authorization) {
        return null;
      }

      const expected = Buffer.from(expectedAuthorization);
      const received = Buffer.from(authorization);

      if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
        return null;
      }

      return { kind: "private-service" };
    },
  };
}
