import { assertEquals } from "@std/assert";
import { SlackFunctionTester } from "deno-slack-sdk/mod.ts";
import { stubFetch } from "../../../shared/testing/fetch_stub.ts";
import { createTestGoogleServiceAccountEnv } from "../../../shared/testing/test_google_key.ts";
import { SaveNewMemberFunction } from "./definition.ts";
import handler from "./mod.ts";

const { createContext } = SlackFunctionTester(SaveNewMemberFunction);

const baseInputs = {
  joinedDate: "01.01.2026",
  firstname: "Test",
  lastname: "Member",
  email: "test@example.com",
  phone: "0123456",
  birthday: "15.03.1990",
  street: "Hauptstraße",
  houseNumber: "1",
  zip: "68159",
  city: "Mannheim",
  sex: "m",
  membershipType: "aktiv",
  IBAN: "DE1234567890",
  BIC: "TESTBIC",
  accountOwner: "",
  signingDate: "01.01.2026",
  adminChannel: "C_ADMIN",
};

async function testEnv() {
  return {
    ...(await createTestGoogleServiceAccountEnv()),
    SPREADSHEET_ID_MASTERDATA: "SHEET_ID",
  };
}

function stubHappyPath(overrides: Record<string, unknown> = {}) {
  return stubFetch({
    responses: {
      "oauth2.googleapis.com/token": { access_token: "t" },
      // saveNewMember: id-column lookup to compute the next row
      "%3AA": { values: [["1"], ["2"]] },
      // saveNewMember: every field write
      "valueInputOption": { ok: true },
      // saveNewMember: final bank-fields readback (row 3, columns A-K)
      "SEPA": {
        values: [[
          "3",
          "",
          "",
          "IBAN123",
          "BIC123",
          "50.00",
          "",
          "MANDATE-REF-1",
          "01.01.2026",
          "",
          "100.00",
        ]],
      },
      "files.getUploadURLExternal": {
        ok: true,
        upload_url: "https://files.slack.com/upload/xyz",
        file_id: "F123",
      },
      "files.slack.com/upload": { ok: true },
      "files.completeUploadExternal": { ok: true, files: [{ id: "F123" }] },
      "files.info": {
        ok: true,
        file: { shares: { private: { C_ADMIN: [{ ts: "111.222" }] } } },
      },
      "chat.getPermalink": {
        ok: true,
        permalink: "https://myteam.slack.com/archives/C_ADMIN/p111222",
      },
      ...overrides,
    },
  });
}

Deno.test("saves the new member, uploads the vCard, and returns SEPA + contact card outputs", async () => {
  const env = await testEnv();
  const stub = stubHappyPath();

  try {
    const result = await handler(createContext({ inputs: baseInputs, env }));

    assertEquals(result.outputs, {
      mandateReference: "MANDATE-REF-1",
      initialAmount: "100.00",
      recurringAmount: "50.00",
      contactCardMessageLink:
        "https://myteam.slack.com/archives/C_ADMIN/p111222",
    });

    const uploadCall = stub.calls.find((call) =>
      call.url.includes("files.slack.com/upload")
    );
    assertEquals(uploadCall !== undefined, true);
  } finally {
    stub.restore();
  }
});

Deno.test("writes the date fields to the sheet unchanged, like the legacy step", async () => {
  const env = await testEnv();
  const stub = stubHappyPath();

  try {
    await handler(createContext({ inputs: baseInputs, env }));

    const writeCalls = stub.calls.filter((call) =>
      call.url.includes("valueInputOption")
    );
    const writtenValues = writeCalls.map((call) =>
      // deno-lint-ignore no-explicit-any
      String((call.body as any).values[0][0])
    );
    assertEquals(writtenValues.includes("01.01.2026"), true);
    assertEquals(writtenValues.includes("15.03.1990"), true);
  } finally {
    stub.restore();
  }
});

Deno.test("returns an error when the sheet can't produce a mandate reference", async () => {
  const env = await testEnv();
  const stub = stubFetch({
    responses: {
      "oauth2.googleapis.com/token": { access_token: "t" },
      "%3AA": { values: [] },
      "valueInputOption": { ok: true },
      "SEPA": { values: [["1", "", "", "", "", "", "", "", "", "", ""]] },
      "files.getUploadURLExternal": {
        ok: true,
        upload_url: "https://files.slack.com/upload/xyz",
        file_id: "F123",
      },
      "files.slack.com/upload": { ok: true },
      "files.completeUploadExternal": { ok: true, files: [{ id: "F123" }] },
      "files.info": { ok: true, file: {} },
    },
  });

  try {
    const result = await handler(createContext({ inputs: baseInputs, env }));
    assertEquals(typeof result.error, "string");
  } finally {
    stub.restore();
  }
});

Deno.test("builds the contact card link for a public admin channel too", async () => {
  const env = await testEnv();
  const stub = stubHappyPath({
    "files.info": {
      ok: true,
      file: { shares: { public: { C_ADMIN: [{ ts: "111.222" }] } } },
    },
  });

  try {
    const result = await handler(createContext({ inputs: baseInputs, env }));

    const permalinkCall = stub.calls.find((call) =>
      call.url.includes("chat.getPermalink")
    );
    // deno-lint-ignore no-explicit-any
    assertEquals(String((permalinkCall?.body as any).message_ts), "111.222");
    assertEquals(
      result.outputs?.contactCardMessageLink,
      "https://myteam.slack.com/archives/C_ADMIN/p111222",
    );
  } finally {
    stub.restore();
  }
});

Deno.test("doesn't post a contact card when saving the member fails", async () => {
  const env = await testEnv();
  const stub = stubFetch({
    responses: {
      "oauth2.googleapis.com/token": {
        __status: 400,
        body: { error: "invalid_grant" },
      },
    },
  });

  try {
    const result = await handler(createContext({ inputs: baseInputs, env }));

    assertEquals(typeof result.error, "string");
    assertEquals(
      stub.calls.some((call) => call.url.includes("files.")),
      false,
    );
  } finally {
    stub.restore();
  }
});
