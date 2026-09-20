import { assertEquals } from "@std/assert";
import { SlackFunctionTester } from "deno-slack-sdk/mod.ts";
import { stubFetch } from "../../../shared/testing/fetch_stub.ts";
import { createTestGoogleServiceAccountEnv } from "../../../shared/testing/test_google_key.ts";
import { SaveNewMemberFunction } from "./definition.ts";
import handler from "./mod.ts";

const { createContext } = SlackFunctionTester(SaveNewMemberFunction);

const baseInputs = {
  joinedDate: "2026-01-01",
  firstname: "Test",
  lastname: "Member",
  email: "test@example.com",
  phone: "0123456",
  birthday: "1990-01-01",
  street: "Hauptstraße",
  houseNumber: "1",
  zip: "68159",
  city: "Mannheim",
  sex: "m",
  membershipType: "aktiv",
  IBAN: "DE1234567890",
  BIC: "TESTBIC",
  signingDate: "2026-01-01",
  adminChannel: "C_ADMIN",
};

async function testEnv() {
  return {
    ...(await createTestGoogleServiceAccountEnv()),
    SPREADSHEET_ID_MASTERDATA: "SHEET_ID",
  };
}

function stubHappyPath() {
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
      "team.info": { ok: true, team: { url: "https://myteam.slack.com/" } },
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

Deno.test("converts date fields to DD.MM.YYYY before writing them to the sheet", async () => {
  const env = await testEnv();
  const stub = stubHappyPath();

  try {
    await handler(createContext({ inputs: baseInputs, env }));

    const writeCalls = stub.calls.filter((call) =>
      call.url.includes("valueInputOption")
    );
    const writtenValues = writeCalls.map((call) =>
      // deno-lint-ignore no-explicit-any
      (call.body as any).values[0][0]
    );
    assertEquals(writtenValues.includes("01.01.2026"), true);
    assertEquals(writtenValues.includes("2026-01-01"), false);
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
      "team.info": { ok: true, team: { url: "https://myteam.slack.com/" } },
    },
  });

  try {
    const result = await handler(createContext({ inputs: baseInputs, env }));
    assertEquals(typeof result.error, "string");
  } finally {
    stub.restore();
  }
});
