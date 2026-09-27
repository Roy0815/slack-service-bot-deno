import { assertEquals, assertThrows } from "@std/assert";
import {
  extractErrorMessage,
  toCreatedSubmission,
  toCreateSubmissionBody,
} from "./docuseal.ts";

Deno.test("builds the submission body in recipient order", () => {
  const body = toCreateSubmissionBody({
    templateId: "42",
    sendEmail: true,
    recipients: [
      {
        roleName: "Coach",
        email: "coach@example.com",
        name: "Max Muster",
        values: { firstName: "Max", monthlyRate: 120 },
      },
      { roleName: "Athlet", email: "athlet@example.com", values: {} },
    ],
  });

  assertEquals(body, {
    template_id: 42,
    send_email: true,
    submitters: [
      {
        role: "Coach",
        email: "coach@example.com",
        name: "Max Muster",
        values: { firstName: "Max", monthlyRate: 120 },
      },
      { role: "Athlet", email: "athlet@example.com", values: {} },
    ],
  });
});

Deno.test("omits the name key for recipients without one", () => {
  const body = toCreateSubmissionBody({
    templateId: "1",
    sendEmail: false,
    recipients: [{ roleName: "Coach", email: "c@example.com", values: {} }],
  });

  assertEquals("name" in body.submitters[0], false);
  assertEquals(body.send_email, false);
});

Deno.test("rejects a template id that is not a positive integer", () => {
  for (const templateId of ["", "abc", "1.5", "-3", "0"]) {
    assertThrows(
      () =>
        toCreateSubmissionBody({ templateId, sendEmail: true, recipients: [] }),
      Error,
      "Ungültige Vorlagen-ID",
    );
  }
});

Deno.test("maps the submitter array onto a created submission", () => {
  const created = toCreatedSubmission([
    {
      submission_id: 7,
      role: "Coach",
      email: "coach@example.com",
      name: "Max",
      embed_src: "https://docuseal.eu/s/abc",
    },
    {
      submission_id: 7,
      role: "Athlet",
      email: "athlet@example.com",
      name: null,
      embed_src: null,
    },
  ]);

  assertEquals(created, {
    submissionId: "7",
    recipients: [
      {
        role: "Coach",
        email: "coach@example.com",
        name: "Max",
        signingUrl: "https://docuseal.eu/s/abc",
      },
      {
        role: "Athlet",
        email: "athlet@example.com",
        name: undefined,
        signingUrl: "",
      },
    ],
  });
});

Deno.test("an empty submitter array is an error, not a silent success", () => {
  assertThrows(() => toCreatedSubmission([]), Error, "keine Empfänger");
});

Deno.test("reads the error message from every shape DocuSeal uses", () => {
  assertEquals(
    extractErrorMessage('{"error":"Template not found"}'),
    "Template not found",
  );
  assertEquals(
    extractErrorMessage('{"errors":["email is invalid","role is missing"]}'),
    "email is invalid, role is missing",
  );
  assertEquals(extractErrorMessage("502 Bad Gateway"), "502 Bad Gateway");
  assertEquals(extractErrorMessage('{"unrelated":true}'), '{"unrelated":true}');
  assertEquals(extractErrorMessage(""), undefined);
});
