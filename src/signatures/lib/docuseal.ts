import {
  CreatedSubmission,
  CreateSubmissionInput,
  SignatureProvider,
} from "./types.ts";

/**
 * DocuSeal implementation of the SignatureProvider interface.
 *
 * This is the ONLY file that connects to DocuSeal
 * Switching to another signature service means
 * adding a sibling file and changing the single line in provider.ts
 *
 * API reference: https://www.docuseal.com/docs/api
 */

const DEFAULT_API_URL = "https://api.docuseal.eu";

// --- DocuSeal payload shapes

type DocuSealSubmitterParams = {
  role: string;
  email: string;
  name?: string;
  values: Record<string, unknown>;
};

export type DocuSealCreateSubmissionBody = {
  template_id: number;
  send_email: boolean;
  submitters: DocuSealSubmitterParams[];
};

type DocuSealSubmitterResult = {
  submission_id: number;
  role?: string | null;
  email?: string | null;
  name?: string | null;
  embed_src?: string | null;
};

// --- Mapping (exported for unit tests)

/**
 * `submitters` order is meaningful: without an explicit `order` DocuSeal
 * notifies the parties one after another ("preserved"), so the recipients
 * are passed through in the order they were given.
 */
export function toCreateSubmissionBody(
  { templateId, sendEmail, recipients }: CreateSubmissionInput,
): DocuSealCreateSubmissionBody {
  const template_id = Number(templateId);

  if (!Number.isInteger(template_id) || template_id <= 0) {
    throw new Error(`Ungültige Vorlagen-ID "${templateId}"`);
  }

  return {
    template_id,
    send_email: sendEmail,
    submitters: recipients.map((recipient) => ({
      role: recipient.roleName,
      email: recipient.email,
      ...(recipient.name ? { name: recipient.name } : {}),
      values: recipient.values,
    })),
  };
}

export function toCreatedSubmission(
  results: DocuSealSubmitterResult[],
): CreatedSubmission {
  if (!Array.isArray(results) || results.length === 0) {
    throw new Error("DocuSeal hat keine Empfänger zurückgegeben");
  }

  return {
    submissionId: String(results[0].submission_id),
    recipients: results.map((result) => ({
      role: result.role ?? "",
      email: result.email ?? "",
      name: result.name ?? undefined,
      signingUrl: result.embed_src ?? "",
    })),
  };
}

/**
 * DocuSeal reports failures as `{"error": "..."}`, sometimes as
 * `{"errors": [...]}` and occasionally as plain text (e.g. from a proxy in
 * front of it), so the raw body is the last resort.
 */
export function extractErrorMessage(body: string): string | undefined {
  if (!body) return undefined;

  try {
    const parsed = JSON.parse(body);
    if (typeof parsed?.error === "string") return parsed.error;
    if (Array.isArray(parsed?.errors)) return parsed.errors.join(", ");
  } catch {
    // not JSON - fall through to the raw body
  }

  return body.slice(0, 300);
}

// --- Provider --------------------------------------------------------------

export function createDocuSealProvider(
  env: Record<string, string>,
): SignatureProvider {
  const apiKey = env["DOCUSEAL_API_KEY"];
  // `||` rather than `??`: .devcontainer/generate-env.sh writes an empty
  // string (not an absent key) when a Codespaces secret is unset.
  const apiUrl = (env["DOCUSEAL_API_URL"] || DEFAULT_API_URL).replace(
    /\/+$/,
    "",
  );

  async function request<T>(path: string, body: unknown): Promise<T> {
    if (!apiKey) {
      throw new Error(
        "DOCUSEAL_API_KEY ist nicht gesetzt (siehe .env.example)",
      );
    }

    const response = await fetch(`${apiUrl}${path}`, {
      method: "POST",
      headers: {
        "X-Auth-Token": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const text = await response.text();

    if (!response.ok) {
      throw new Error(
        `DocuSeal ${response.status}: ${
          extractErrorMessage(text) ?? response.statusText
        }`,
      );
    }

    return JSON.parse(text) as T;
  }

  return {
    providerName: "DocuSeal",

    async createSubmission(
      input: CreateSubmissionInput,
    ): Promise<CreatedSubmission> {
      return toCreatedSubmission(
        await request<DocuSealSubmitterResult[]>(
          "/submissions",
          toCreateSubmissionBody(input),
        ),
      );
    },
  };
}
