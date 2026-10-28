import { assertEquals } from "@std/assert";
import { SlackFunctionTester } from "deno-slack-sdk/mod.ts";
import { stubFetch } from "../../../shared/testing/fetch_stub.ts";
import { createTestGoogleServiceAccountEnv } from "../../../shared/testing/test_google_key.ts";
import { SaveBankDetailsFunction } from "./definition.ts";
import handler from "./mod.ts";

const { createContext } = SlackFunctionTester(SaveBankDetailsFunction);

/** A member row of "Allg Daten" with id 5 and the given Slack ID */
function memberRow(slackId: string): string[] {
  const row = Array(16).fill("");
  row[0] = "5";
  row[1] = "Max";
  row[2] = "Mustermann";
  row[15] = slackId;
  return row;
}

Deno.test("writes the normalized bank details into the member's SEPA row", async () => {
  const env = {
    ...(await createTestGoogleServiceAccountEnv()),
    SPREADSHEET_ID_MASTERDATA: "SHEET_ID",
  };

  const stub = stubFetch({
    responses: {
      "oauth2.googleapis.com/token": { access_token: "t" },
      "sheets.googleapis.com": { values: [["header"], memberRow("U_MEMBER")] },
    },
  });

  try {
    const result = await handler(
      createContext({
        inputs: {
          user: "U_MEMBER",
          IBAN: "de89 3704 0044 0532 0130 00",
          BIC: "cobadeffxxx",
          accountOwner: "Erika Mustermann",
          signingDate: "2026-10-28",
        },
        env,
      }),
    );

    assertEquals(result.outputs, {});

    const updates = Object.fromEntries(
      stub.calls
        .filter((call) => call.method === "PUT")
        .map((call) => [
          decodeURIComponent(new URL(call.url).pathname.split("/").pop()!),
          // deno-lint-ignore no-explicit-any
          (call.body as any).values[0][0],
        ]),
    );

    // member id 5 -> row 6 (header), columns from bankDatenColumns
    assertEquals(updates, {
      "'SEPA Daten'!D6": "DE89370400440532013000",
      "'SEPA Daten'!E6": "COBADEFFXXX",
      "'SEPA Daten'!J6": "Erika Mustermann",
      "'SEPA Daten'!I6": "28.10.2026",
    });
  } finally {
    stub.restore();
  }
});

Deno.test("clears the account owner when it is the member's own name", async () => {
  const env = {
    ...(await createTestGoogleServiceAccountEnv()),
    SPREADSHEET_ID_MASTERDATA: "SHEET_ID",
  };

  const stub = stubFetch({
    responses: {
      "oauth2.googleapis.com/token": { access_token: "t" },
      "sheets.googleapis.com": { values: [["header"], memberRow("U_MEMBER")] },
    },
  });

  try {
    await handler(
      createContext({
        inputs: {
          user: "U_MEMBER",
          IBAN: "DE89370400440532013000",
          BIC: "COBADEFF",
          accountOwner: "Max Mustermann",
        },
        env,
      }),
    );

    const ownerCall = stub.calls.find((call) =>
      call.method === "PUT" && call.url.includes("J6")
    );
    // deno-lint-ignore no-explicit-any
    assertEquals((ownerCall?.body as any).values, [[""]]);
    // no signing date given -> column untouched
    assertEquals(stub.calls.some((call) => call.url.includes("I6")), false);
  } finally {
    stub.restore();
  }
});

Deno.test("fails without writing anything for an invalid IBAN or unknown member", async () => {
  const env = {
    ...(await createTestGoogleServiceAccountEnv()),
    SPREADSHEET_ID_MASTERDATA: "SHEET_ID",
  };

  const stub = stubFetch({
    responses: {
      "oauth2.googleapis.com/token": { access_token: "t" },
      "sheets.googleapis.com": { values: [["header"], memberRow("U_OTHER")] },
    },
  });

  try {
    for (
      const inputs of [
        { user: "U_OTHER", IBAN: "DE00123", BIC: "COBADEFF" },
        { user: "U_UNKNOWN", IBAN: "DE89370400440532013000", BIC: "COBADEFF" },
      ]
    ) {
      const result = await handler(createContext({ inputs, env }));
      assertEquals(typeof result.error, "string");
    }

    assertEquals(stub.calls.some((call) => call.method === "PUT"), false);
  } finally {
    stub.restore();
  }
});
