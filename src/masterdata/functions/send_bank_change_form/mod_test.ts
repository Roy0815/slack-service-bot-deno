import { assertEquals } from "@std/assert";
import { SlackFunctionTester } from "deno-slack-sdk/mod.ts";
import { stubFetch } from "../../../shared/testing/fetch_stub.ts";
import { createTestGoogleServiceAccountEnv } from "../../../shared/testing/test_google_key.ts";
import { SendBankChangeFormFunction } from "./definition.ts";
import handler from "./mod.ts";

const { createContext } = SlackFunctionTester(SendBankChangeFormFunction);

const inputs = {
  user: "U_MEMBER",
  changeDate: "2026-11-15",
  templateId: "42",
};

async function testEnv() {
  return {
    ...(await createTestGoogleServiceAccountEnv()),
    SPREADSHEET_ID_MASTERDATA: "SHEET_ID",
    DOCUSEAL_API_KEY: "key",
  };
}

/** A member row of "Allg Daten" with the given email */
function memberRow(email: string): string[] {
  const row = Array(16).fill("");
  row[0] = "5";
  row[9] = email;
  row[15] = "U_MEMBER";
  return row;
}

Deno.test("sends the form to the masterdata email with slack id and date as metadata", async () => {
  const stub = stubFetch({
    responses: {
      "oauth2.googleapis.com/token": { access_token: "t" },
      "sheets.googleapis.com": {
        values: [["header"], memberRow("max@example.com")],
      },
      // wrapped twice: an array value is a response sequence (fetch_stub.ts)
      "api.docuseal.eu/submissions": [[{
        submission_id: 7,
        role: "Mitglied",
        email: "max@example.com",
      }]],
    },
  });

  try {
    const result = await handler(
      createContext({ inputs, env: await testEnv() }),
    );

    assertEquals(result.outputs, {
      submissionId: "7",
      email: "max@example.com",
    });

    const docusealCall = stub.calls.find((call) =>
      call.url.includes("docuseal")
    );
    assertEquals(docusealCall?.body, {
      template_id: 42,
      send_email: true,
      submitters: [{
        role: "Mitglied",
        email: "max@example.com",
        values: {},
        metadata: { slackId: "U_MEMBER", changeDate: "2026-11-15" },
      }],
    });
  } finally {
    stub.restore();
  }
});

Deno.test("tells the member by DM and fails when DocuSeal rejects the request", async () => {
  const stub = stubFetch({
    responses: {
      "oauth2.googleapis.com/token": { access_token: "t" },
      "sheets.googleapis.com": {
        values: [["header"], memberRow("max@example.com")],
      },
      "api.docuseal.eu/submissions": {
        __status: 422,
        body: { error: "Template not found" },
      },
      "chat.postMessage": { ok: true },
    },
  });

  try {
    const result = await handler(
      createContext({ inputs, env: await testEnv() }),
    );

    assertEquals(result.error?.includes("Template not found"), true);

    const dm = stub.calls.find((call) => call.url.includes("chat.postMessage"));
    // deno-lint-ignore no-explicit-any
    assertEquals((dm?.body as any).channel, "U_MEMBER");
  } finally {
    stub.restore();
  }
});

Deno.test("never sends the form when the masterdata has no email", async () => {
  const stub = stubFetch({
    responses: {
      "oauth2.googleapis.com/token": { access_token: "t" },
      "sheets.googleapis.com": { values: [["header"], memberRow("")] },
      "chat.postMessage": { ok: true },
    },
  });

  try {
    const result = await handler(
      createContext({ inputs, env: await testEnv() }),
    );

    assertEquals(typeof result.error, "string");
    assertEquals(
      stub.calls.some((call) => call.url.includes("docuseal")),
      false,
    );
  } finally {
    stub.restore();
  }
});
