import type { User } from "./types.ts";

/**
 * Builds a vCard 3.0 contact (name, email, phone) for the admins' address
 * books. The phone's leading "'" (stored to stop Sheets from reading "+49..."
 * as a formula) is stripped.
 */
export function buildVCard(
  { firstname, lastname, email, phone }: Pick<
    User,
    "firstname" | "lastname" | "email" | "phone"
  >,
): string {
  return [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `N:${lastname};${firstname}`,
    `FN:${firstname} ${lastname}`,
    `EMAIL:${email}`,
    `TEL;TYPE=voice:${phone.replace(/^'/, "")}`,
    "END:VCARD",
  ].join("\r\n");
}
