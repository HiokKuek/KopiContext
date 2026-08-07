import "server-only";

import type { Session } from "next-auth";
import { getServerSession } from "next-auth/next";
import Google, { type GoogleProfile } from "next-auth/providers/google";
import type { AuthOptions } from "next-auth";

/**
 * The only identity shape the editorial application needs. `actorId` is a
 * Google subject, rather than an email address, so audit records do not rely
 * on a mutable display attribute.
 */
export type EditorIdentity = Readonly<{
  actorId: string;
  email: string;
}>;

/** Auth.js Session extended with the non-secret Google subject we add in its session callback. */
type EditorSession = Omit<Session, "user"> & {
  user?: Session["user"] & { id?: string | null };
};

export type EditorAuthEnvironment = Readonly<{
  EDITOR_ALLOWED_EMAIL?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  NEXTAUTH_SECRET?: string;
  NEXTAUTH_URL?: string;
}>;

export type EditorAuthConfiguration = Readonly<{
  allowedEmail: string;
  googleClientId: string;
  googleClientSecret: string;
  nextAuthSecret: string;
  nextAuthUrl: string;
}>;

export class EditorAuthConfigurationError extends Error {
  readonly name = "EditorAuthConfigurationError";
}

export class EditorAuthenticationRequiredError extends Error {
  readonly name = "EditorAuthenticationRequiredError";
}

export class EditorAccessDeniedError extends Error {
  readonly name = "EditorAccessDeniedError";
}

/**
 * Resolves auth configuration lazily. This is deliberately not evaluated at
 * module load time: public routes can build and run without editor secrets,
 * while any attempt to use `/api/auth` or an editor-only route fails closed.
 */
export function readEditorAuthConfiguration(
  environment: EditorAuthEnvironment = process.env,
): EditorAuthConfiguration {
  const allowedEmail = normaliseEmail(environment.EDITOR_ALLOWED_EMAIL);
  const googleClientId = requiredValue(environment.GOOGLE_CLIENT_ID, "GOOGLE_CLIENT_ID");
  const googleClientSecret = requiredValue(environment.GOOGLE_CLIENT_SECRET, "GOOGLE_CLIENT_SECRET");
  const nextAuthSecret = requiredValue(environment.NEXTAUTH_SECRET, "NEXTAUTH_SECRET");
  const nextAuthUrl = requiredUrl(environment.NEXTAUTH_URL, "NEXTAUTH_URL");

  if (allowedEmail === undefined) {
    throw new EditorAuthConfigurationError(
      "EDITOR_ALLOWED_EMAIL must contain exactly one valid editor email address.",
    );
  }

  return {
    allowedEmail,
    googleClientId,
    googleClientSecret,
    nextAuthSecret,
    nextAuthUrl,
  };
}

/** Creates the Google-only Auth.js configuration for the private editor. */
export function createEditorAuthOptions(
  environment: EditorAuthEnvironment = process.env,
): AuthOptions {
  const configuration = readEditorAuthConfiguration(environment);

  return {
    providers: [
      Google({
        clientId: configuration.googleClientId,
        clientSecret: configuration.googleClientSecret,
      }),
    ],
    secret: configuration.nextAuthSecret,
    callbacks: {
      async signIn({ account, profile }) {
        return account?.provider === "google" && isAllowedGoogleProfile(profile, configuration.allowedEmail);
      },
      async session({ session, token }) {
        const subject = normaliseGoogleSubject(token.sub);
        if (session.user !== undefined && subject !== undefined) {
          // Auth.js intentionally keeps arbitrary fields out of Session's
          // default type. This non-secret provider subject is the stable input
          // to the server-only EditorIdentity boundary below.
          (session.user as { id?: string }).id = subject;
        }
        return session;
      },
    },
  };
}

/**
 * Requires a server-verified Auth.js session and re-checks its authorisation
 * before deriving the actor used by editorial commands. No browser request is
 * allowed to supply this actor ID.
 */
export async function requireEditorSession(): Promise<EditorIdentity> {
  const configuration = readEditorAuthConfiguration();
  const session = await getServerSession(createEditorAuthOptions());
  return requireEditorIdentity(session, configuration);
}

/** A provider-neutral, testable authorisation boundary for editor sessions. */
export function requireEditorIdentity(
  session: EditorSession | null,
  configuration: Pick<EditorAuthConfiguration, "allowedEmail">,
): EditorIdentity {
  if (session === null || session.user === undefined) {
    throw new EditorAuthenticationRequiredError("A signed-in editor session is required.");
  }

  const email = normaliseEmail(session.user.email);
  if (email === undefined || email !== configuration.allowedEmail) {
    throw new EditorAccessDeniedError("This account is not authorised to use the editor.");
  }

  const subject = normaliseGoogleSubject(session.user.id);
  if (subject === undefined) {
    throw new EditorAccessDeniedError("The editor session does not have a stable Google identity.");
  }

  return { actorId: `google:${subject}`, email };
}

export function isAllowedGoogleProfile(profile: unknown, allowedEmail: string): boolean {
  if (!isGoogleProfile(profile) || profile.email_verified !== true) {
    return false;
  }

  return normaliseEmail(profile.email) === allowedEmail;
}

function isGoogleProfile(value: unknown): value is GoogleProfile {
  return typeof value === "object" && value !== null && "email" in value && "email_verified" in value;
}

function normaliseEmail(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalised = value.trim().toLowerCase();
  // This deliberately accepts one ordinary mailbox only. In particular it
  // rejects comma-separated allowlists and display-name forms.
  if (!/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/.test(normalised)) {
    return undefined;
  }

  return normalised;
}

function normaliseGoogleSubject(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const subject = value.trim();
  return /^[A-Za-z0-9_-]{8,255}$/.test(subject) ? subject : undefined;
}

function requiredValue(value: string | undefined, name: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new EditorAuthConfigurationError(`${name} must be configured before editor authentication can be used.`);
  }

  return value.trim();
}

function requiredUrl(value: string | undefined, name: string): string {
  const configured = requiredValue(value, name);
  try {
    const url = new URL(configured);
    if (url.protocol !== "https:" && url.hostname !== "localhost") {
      throw new Error("insecure URL");
    }
  } catch {
    throw new EditorAuthConfigurationError(`${name} must be an absolute HTTPS URL (or localhost for development).`);
  }
  return configured;
}
