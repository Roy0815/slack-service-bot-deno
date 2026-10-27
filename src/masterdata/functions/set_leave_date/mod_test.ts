import { assertEquals } from "@std/assert";
import { SlackFunctionTester } from "deno-slack-sdk/mod.ts";
import { stubFetch } from "../../../shared/testing/fetch_stub.ts";
import { createTestGoogleServiceAccountEnv } from "../../../shared/testing/test_google_key.ts";
import { SetLeaveDateFunction } from "./definition.ts";
import handler from "./mod.ts";

const { createContext } = SlackFunctionTester(SetLeaveDateFunction);

Deno.test("resolves the user by slack id and writes the German-formatted leave date", async () => {
  const env = {
    ...(await createTestGoogleServiceAccountEnv()),
    SPREADSHEET_ID_MASTERDATA: "SHEET_ID",
  };

  const stub = stubFetch({
    responses: {
      "oauth2.googleapis.com/token": { access_token: "t" },
      // saveLeaveDate's cell update (more specific match wins - see fetch_stub.ts)
      "!E": { values: [] },
      // getUserFromId's row lookup
      "sheets.googleapis.com": {
        values: [
          ["header"],
          [
            "5",
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
            "",
            "",
            "",
            "U_LEAVING",
          ],
        ],
      },
    },
  });

  try {
    const result = await handler(
      createContext({
        inputs: { leaveUser: "U_LEAVING", leaveDate: "2026-09-01" },
        env,
      }),
    );

    assertEquals(result.outputs, {});

    const updateCall = stub.calls.find((call) => call.method === "PUT");
    // resolved user's id is 5 (from the sheet row), so the target row is 5+1
    assertEquals(updateCall?.url.includes("E6"), true);
    // deno-lint-ignore no-explicit-any
    assertEquals((updateCall?.body as any).values, [["01.09.2026"]]);
  } finally {
    stub.restore();
  }
});

Deno.test("returns an error output instead of throwing when saving fails", async () => {
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
        inputs: { leaveUser: "U_LEAVING", leaveDate: "2026-09-01" },
        env,
      }),
    );

    assertEquals(typeof result.error, "string");
  } finally {
    stub.restore();
  }
});
