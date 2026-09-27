import { assertEquals, assertThrows } from "@std/assert";
import { buildRecipients, parseDocumentValues } from "./recipients.ts";
import { CoachingRoles } from "../../coaching_contract.ts";

const emails = {
  coachEmail: "coach@example.com",
  athleteEmail: "athlet@example.com",
  board1Email: "vorstand1@example.com",
  board2Email: "vorstand2@example.com",
};

// --- parseDocumentValues ---------------------------------------------------

Deno.test("parses the JSON produced by the form step", () => {
  const values = parseDocumentValues(
    '{"firstName":"Max","monthlyRate":120,"coachingStartDate":"2026-10-01"}',
  );

  assertEquals(values, {
    firstName: "Max",
    monthlyRate: 120,
    coachingStartDate: "2026-10-01",
  });
});

Deno.test("rejects input that is not JSON", () => {
  assertThrows(
    () => parseDocumentValues("firstName=Max"),
    Error,
    "kein gültiges JSON",
  );
});

Deno.test("rejects JSON that is not a flat object", () => {
  for (const json of ["null", "[1,2]", '"text"', "42"]) {
    assertThrows(() => parseDocumentValues(json), Error, "JSON-Objekt");
  }
});

Deno.test("rejects nested values, naming the field", () => {
  assertThrows(
    () => parseDocumentValues('{"address":{"street":"x"}}'),
    Error,
    '"address"',
  );
});

// --- buildRecipients -------------------------------------------------------

Deno.test("builds the four parties in signing order", () => {
  const recipients = buildRecipients({ firstName: "Max" }, emails);

  assertEquals(recipients.map(({ roleName }) => roleName), [
    CoachingRoles.coach,
    CoachingRoles.athlete,
    CoachingRoles.board1,
    CoachingRoles.board2,
  ]);
  assertEquals(recipients.map(({ email }) => email), [
    emails.coachEmail,
    emails.athleteEmail,
    emails.board1Email,
    emails.board2Email,
  ]);
});

Deno.test("only the coach carries the document values", () => {
  const values = { firstName: "Max", monthlyRate: 120 };
  const [coach, ...others] = buildRecipients(values, emails);

  assertEquals(coach.values, values);
  for (const recipient of others) assertEquals(recipient.values, {});
});

Deno.test("trims emails and names the role of an invalid one", () => {
  const [coach] = buildRecipients({}, {
    ...emails,
    coachEmail: "  coach@example.com  ",
  });
  assertEquals(coach.email, "coach@example.com");

  assertThrows(
    () => buildRecipients({}, { ...emails, board2Email: "nope" }),
    Error,
    `"${CoachingRoles.board2}"`,
  );
});
