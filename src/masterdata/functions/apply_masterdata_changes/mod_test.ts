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
          slackId: "U1",
          firstname: "Maximilian",
          // unchanged fields arrive empty from Workflow Builder
          lastname: "",
          city: "Heidelberg",
        },
        env,
      }),
    );

    assertEquals(result.outputs, {});

    // slackId only identifies the row and is not written back
    const putCalls = stub.calls.filter((call) => call.method === "PUT");
    assertEquals(putCalls.length, 2);

    const newValues = putCalls.map((call) =>
      // deno-lint-ignore no-explicit-any
      (call.body as any).values[0][0]
    );
    assertEquals(newValues.sort(), ["Heidelberg", "Maximilian"]);
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
        inputs: { slackId: "U1", firstname: "Maximilian" },
        env,
      }),
    );

    assertEquals(typeof result.error, "string");
  } finally {
    stub.restore();
  }
});

Deno.test("returns an error output when the member isn't in the masterdata", async () => {
  const env = {
    ...(await createTestGoogleServiceAccountEnv()),
    SPREADSHEET_ID_MASTERDATA: "SHEET_ID",
  };

  const stub = stubFetch({
    responses: {
      "oauth2.googleapis.com/token": { access_token: "t" },
      "sheets.googleapis.com": { values: [["header"]] },
    },
  });

  try {
    const result = await handler(
      createContext({
        inputs: { slackId: "U_UNKNOWN", firstname: "Max" },
        env,
      }),
    );

    assertEquals(
      result.error,
      "Fehler beim Speichern der Stammdatenänderungen: Mitglied nicht in den Stammdaten gefunden",
    );
    assertEquals(stub.calls.some((call) => call.method === "PUT"), false);
  } finally {
    stub.restore();
  }
});
