import { CoachingFields, CoachingRoles } from "../../coaching_contract.ts";
import { SignatureRecipient, SignatureValue } from "../../lib/types.ts";
import { EmailPattern } from "../../../shared/util.ts";

const KnownFieldNames: string[] = Object.values(CoachingFields);

export type CoachingRequestEmails = {
  coachEmail: string;
  athleteEmail: string;
  board1Email: string;
  board2Email: string;
};

/**
 * Parses the `documentValues` JSON produced by the "Coaching-Vertrag
 * ausfüllen" step. Anything that is not a flat object of primitive values
 * is rejected with a message that names the problem, since the string may
 * also have been typed by hand into the workflow.
 */
export function parseDocumentValues(
  json: string,
): Record<string, SignatureValue> {
  let parsed: unknown;

  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error("'Dokumentwerte' ist kein gültiges JSON");
  }

  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(
      "'Dokumentwerte' muss ein JSON-Objekt sein ({ \"feldname\": wert })",
    );
  }

  const values: Record<string, SignatureValue> = {};

  for (const [name, value] of Object.entries(parsed)) {
    if (!KnownFieldNames.includes(name)) {
      throw new Error(`'Dokumentwerte': unbekanntes Feld "${name}"`);
    }
    if (!isSignatureValue(value)) {
      throw new Error(
        `'Dokumentwerte': Feld "${name}" hat einen nicht unterstützten Wert`,
      );
    }
    values[name] = value;
  }

  return values;
}

function isSignatureValue(value: unknown): value is SignatureValue {
  return typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean" ||
    (Array.isArray(value) && value.every((item) => typeof item === "string"));
}

/**
 * The four parties of a coaching contract in signing order. Only the coach
 * carries the pre-filled document values - every field of the template is
 * assigned to the coach's role.
 */
export function buildRecipients(
  values: Record<string, SignatureValue>,
  emails: CoachingRequestEmails,
): SignatureRecipient[] {
  return [
    {
      roleName: CoachingRoles.coach,
      email: validEmail(emails.coachEmail, CoachingRoles.coach),
      values,
    },
    {
      roleName: CoachingRoles.athlete,
      email: validEmail(emails.athleteEmail, CoachingRoles.athlete),
      values: {},
    },
    {
      roleName: CoachingRoles.board1,
      email: validEmail(emails.board1Email, CoachingRoles.board1),
      values: {},
    },
    {
      roleName: CoachingRoles.board2,
      email: validEmail(emails.board2Email, CoachingRoles.board2),
      values: {},
    },
  ];
}

function validEmail(email: string | undefined, role: string): string {
  const trimmed = email?.trim() ?? "";

  if (!EmailPattern.test(trimmed)) {
    throw new Error(
      `Keine gültige E-Mail-Adresse für "${role}": "${trimmed}"`,
    );
  }

  return trimmed;
}
