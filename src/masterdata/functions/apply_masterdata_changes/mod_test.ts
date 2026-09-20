import { assertEquals } from "@std/assert";
import { SlackFunctionTester } from "deno-slack-sdk/mod.ts";
import { stubFetch } from "../../../shared/testing/fetch_stub.ts";
import { createTestGoogleServiceAccountEnv } from "../../../shared/testing/test_google_key.ts";
import { ApplyMasterdataChangesFunction } from "./definition.ts";
import handler from "./mod.ts";

const { createContext } = SlackFunctionTester(ApplyMasterdataChangesFunction);

Deno.test("writes only the changed fields' new values via the masterdata service", async () => {
  const env = {
    ...(await createTestGoogleServiceAccountEnv()),
    SPREADSHEET_ID_MASTERDATA: "SHEET_ID",
  };

  const stub = stubFetch({
    responses: {
      "oauth2.googleapis.com/token": { access_token: "t" },
      "sheets.googleapis.com": {
        values: [
          ["header"],
          [
            "3",
            "Max",
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            "Mannheim",
            "",
            "U1",
          ],
        ],
      },
    },
  });

  try {
    const result = await handler(
      createContext({
        inputs: {
          changes: {
            slackId: "U1",
            firstname: "Maximilian",
            city: "Heidelberg",
          },
        },
        env,
      }),
    );

    assertEquals(result.outputs, {});

    // 2 changed fields + 1 harmless slackId rewrite (see
    // google_sheets_service.ts's saveMasterdataChanges: it re-writes
    // slackId unchanged rather than excluding it, ported as-is from the
    // old bot's behavior)
    const putCalls = stub.calls.filter((call) => call.method === "PUT");
    assertEquals(putCalls.length, 3);

    const newValues = putCalls.map((call) =>
      // deno-lint-ignore no-explicit-any
      (call.body as any).values[0][0]
    );
    assertEquals(newValues.sort(), ["Heidelberg", "Maximilian", "U1"]);
  } finally {
    stub.restore();
  }
});

Deno.test("returns an error output when the masterdata service call fails", async () => {
  const env = {
    ...(await createTestGoogleServiceAccountEnv()),
    SPREADSHEET_ID_MASTERDATA: "SHEET_ID",
  };

  const stub = stubFetch({
    responses: {
      "oauth2.googleapis.com/token": {
        __status: 400,
        body: { error: "invalid_grant" },
      },
    },
  });

  try {
    const result = await handler(
      createContext({
        inputs: {
          changes: { slackId: "U1", firstname: "Maximilian" },
        },
        env,
      }),
    );

    assertEquals(typeof result.error, "string");
  } finally {
    stub.restore();
  }
});
