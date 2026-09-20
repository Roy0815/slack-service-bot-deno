import { assertEquals } from "@std/assert";
import { stubFetch } from "../testing/fetch_stub.ts";
import { createTestGoogleServiceAccountEnv } from "../testing/test_google_key.ts";
import {
  convertNumberToColumn,
  createGoogleSheetsMasterdataService,
  formatGermanDate,
  parseGermanDate,
} from "./google_sheets_service.ts";

Deno.test("convertNumberToColumn maps 1-based column numbers to letters", () => {
  assertEquals(convertNumberToColumn(1), "A");
  assertEquals(convertNumberToColumn(2), "B");
  assertEquals(convertNumberToColumn(16), "P");
});

Deno.test("parseGermanDate reads a DD.MM.YYYY string into the matching Date", () => {
  const date = parseGermanDate("28.07.2026");
  assertEquals(date.getFullYear(), 2026);
  assertEquals(date.getMonth(), 6); // 0-indexed: July
  assertEquals(date.getDate(), 28);
});

Deno.test("formatGermanDate is the inverse of parseGermanDate for a fixed date", () => {
  const formatted = formatGermanDate(new Date(2026, 6, 28, 12, 0, 0));
  assertEquals(formatted, "28.07.2026");
});

Deno.test("getUserFromId reads a user by row index from the Allg Daten sheet", async () => {
  const env = await createTestGoogleServiceAccountEnv();
  const stub = stubFetch({
    responses: {
      "oauth2.googleapis.com/token": { access_token: "t" },
      "sheets.googleapis.com": {
        values: [
          ["ID", "Vorname", "Nachname"],
          [
            "1",
            "Max",
            "Mustermann",
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
            "U1",
          ],
        ],
      },
    },
  });

  try {
    const service = createGoogleSheetsMasterdataService(env, "SHEET_ID");
    const user = await service.getUserFromId({ id: 1 });

    assertEquals(user?.firstname, "Max");
    assertEquals(user?.lastname, "Mustermann");
    assertEquals(user?.id, 1);
  } finally {
    stub.restore();
  }
});

Deno.test("saveLeaveDate writes the leave date column for the resolved row", async () => {
  const env = await createTestGoogleServiceAccountEnv();
  const stub = stubFetch({
    responses: {
      "oauth2.googleapis.com/token": { access_token: "t" },
      "sheets.googleapis.com": { values: [] },
    },
  });

  try {
    const service = createGoogleSheetsMasterdataService(env, "SHEET_ID");
    await service.saveLeaveDate({ id: 5 }, "01.09.2026");

    const updateCall = stub.calls.find((call) => call.method === "PUT");
    assertEquals(updateCall?.url.includes("Allg%20Daten"), true);
    // leaveDate is column E (5th), row 6 (id 5 + header)
    assertEquals(updateCall?.url.includes("E6"), true);
    // deno-lint-ignore no-explicit-any
    assertEquals((updateCall?.body as any).values, [["01.09.2026"]]);
  } finally {
    stub.restore();
  }
});
