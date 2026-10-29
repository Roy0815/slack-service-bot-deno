import { assertEquals } from "@std/assert";
import { collectAttachments, messageDate } from "./attachments.ts";

const emailFile = {
  id: "F0CALU608GG",
  filetype: "email",
  mode: "email",
  name: "Neues Dokument für deine Bestellung",
  attachments: [{
    filename: "invoice_4188622.pdf",
    url: "https://files-origin.slack.com/files-email-priv/invoice_4188622.pdf",
    slack_file_id: "F0C9LAFG24B",
  }],
};

Deno.test("offers only the attachments of an email, not the email itself", () => {
  assertEquals(collectAttachments({ files: [emailFile] }), [{
    fileId: "F0C9LAFG24B",
    name: "invoice_4188622.pdf",
    url: "https://files-origin.slack.com/files-email-priv/invoice_4188622.pdf",
  }]);
});

Deno.test("an email without attachments offers nothing", () => {
  assertEquals(
    collectAttachments({ files: [{ ...emailFile, attachments: [] }] }),
    [],
  );
});

Deno.test("offers regular files and skips deleted ones", () => {
  assertEquals(
    collectAttachments({
      files: [
        { id: "F1", name: "rechnung.pdf", mode: "hosted" },
        { id: "F2", mode: "tombstone" },
        emailFile,
      ],
    }),
    [
      { fileId: "F1", name: "rechnung.pdf" },
      {
        fileId: "F0C9LAFG24B",
        name: "invoice_4188622.pdf",
        url:
          "https://files-origin.slack.com/files-email-priv/invoice_4188622.pdf",
      },
    ],
  );
});

Deno.test("a message without files offers nothing", () => {
  assertEquals(collectAttachments({ text: "Hallo" }), []);
});

Deno.test("dates a message in Berlin time, not UTC", () => {
  // 2026-10-17 23:30 UTC is already the 18th in Berlin (CEST)
  assertEquals(messageDate("1792279800.000100"), "2026-10-18");
  assertEquals(messageDate("1792141861.000000"), "2026-10-16");
});
