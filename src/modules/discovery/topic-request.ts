/**
 * The privacy-minimising request shape used between the public web BFF and the
 * discovery use case. It intentionally has no account, contact, device,
 * network, or free-form metadata fields.
 */

const MIN_TOPIC_LENGTH = 2;
const MAX_TOPIC_LENGTH = 120;

export type TopicRequest = Readonly<{
  requestedTopic: string;
}>;

export type TopicRequestValidationFailure = Readonly<{
  ok: false;
  reason: "missing-topic" | "topic-too-short" | "topic-too-long" | "personal-information-not-allowed";
}>;

export type TopicRequestValidationResult =
  | Readonly<{ ok: true; request: TopicRequest }>
  | TopicRequestValidationFailure;

/**
 * The transport boundary belongs on a trusted server. A browser may call a
 * same-origin web route, but it must never receive the private API credential
 * or address the private application API itself.
 */
export type TopicRequestTransport = Readonly<{
  submit(request: TopicRequest): Promise<TopicRequestSubmission>;
}>;

export type TopicRequestSubmission = Readonly<{
  status: "received";
}>;

function containsPersonalInformation(value: string) {
  const email = /\b[^\s@]+@[^\s@]+\.[^\s@]+\b/u;
  const ipAddress = /(?:^|[^\d])(?:25[0-5]|2[0-4]\d|1?\d?\d)(?:\.(?:25[0-5]|2[0-4]\d|1?\d?\d)){3}(?:$|[^\d])/u;
  // Singapore numbers are deliberately recognised only when written as a
  // standalone 8-digit number or an explicit +65 number, reducing the chance
  // that normal Topic names are rejected.
  const singaporePhone = /(?:\+65[\s-]?)?\b[689]\d{3}[\s-]?\d{4}\b/u;

  return email.test(value) || ipAddress.test(value) || singaporePhone.test(value);
}

/**
 * Validates and normalises the only reader-supplied value retained for a Topic
 * request. Purposefully do not add an open-ended message: it would invite
 * accidental collection of contact details or sensitive personal context.
 */
export function validateTopicRequest(input: unknown): TopicRequestValidationResult {
  const requestedTopic =
    input && typeof input === "object" && !Array.isArray(input) && "requestedTopic" in input
      ? (input as { requestedTopic?: unknown }).requestedTopic
      : undefined;

  if (typeof requestedTopic !== "string") {
    return { ok: false, reason: "missing-topic" };
  }

  const normalised = requestedTopic.normalize("NFC").trim().replace(/\s+/gu, " ");

  if (!normalised) {
    return { ok: false, reason: "missing-topic" };
  }
  if (normalised.length < MIN_TOPIC_LENGTH) {
    return { ok: false, reason: "topic-too-short" };
  }
  if (normalised.length > MAX_TOPIC_LENGTH) {
    return { ok: false, reason: "topic-too-long" };
  }
  if (containsPersonalInformation(normalised)) {
    return { ok: false, reason: "personal-information-not-allowed" };
  }

  return { ok: true, request: { requestedTopic: normalised } };
}
