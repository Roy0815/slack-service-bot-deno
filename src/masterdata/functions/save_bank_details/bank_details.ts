import { formatSlackDate } from "../../../shared/util.ts";

/**
 * IBAN and BIC arrive as free text from the signed form, so they are
 * normalized (no spaces, upper case) and checked before they end up in
 * the SEPA data - a typo there only surfaces as a failed direct debit.
 */

const BicPattern = /^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/;

export function normalizeIban(iban: string): string {
  const normalized = iban.replace(/\s+/g, "").toUpperCase();

  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(normalized)) {
    throw new Error(`"${iban}" ist keine gültige IBAN`);
  }

  // ISO 13616 check digits: move the first four characters to the end,
  // replace letters by 10..35 and the remainder mod 97 has to be 1
  const digits = (normalized.slice(4) + normalized.slice(0, 4)).replace(
    /[A-Z]/g,
    (letter) => String(letter.charCodeAt(0) - 55),
  );
  let remainder = 0;
  for (const digit of digits) {
    remainder = (remainder * 10 + Number(digit)) % 97;
  }

  if (remainder !== 1) {
    throw new Error(`Die Prüfziffer der IBAN "${iban}" stimmt nicht`);
  }

  return normalized;
}

export function normalizeBic(bic: string): string {
  const normalized = bic.replace(/\s+/g, "").toUpperCase();

  if (!BicPattern.test(normalized)) {
    throw new Error(`"${bic}" ist keine gültige BIC`);
  }

  return normalized;
}

/**
 * The signing date arrives as webhook text in YYYY-MM-DD (the format the
 * signature service uses) and is stored as DD.MM.YYYY. Empty means "not
 * given" and leaves the stored date alone.
 */
export function normalizeSigningDate(
  date: string | undefined,
): string | undefined {
  const trimmed = date?.trim();
  if (!trimmed) return undefined;

  const parsed = new Date(`${trimmed}T00:00:00Z`);
  // the round trip rejects impossible dates like 2026-02-30
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(trimmed) ||
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== trimmed
  ) {
    throw new Error(
      `"${date}" ist kein gültiges Unterschriftsdatum (erwartet JJJJ-MM-TT)`,
    );
  }

  return formatSlackDate(trimmed);
}
