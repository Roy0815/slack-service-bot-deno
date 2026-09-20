import { assertEquals, assertThrows } from "@std/assert";
import { assertOk, formatSlackDate, formatTime, today } from "./util.ts";

Deno.test("formatSlackDate converts ISO date to DD.MM.YYYY", () => {
  assertEquals(formatSlackDate("2026-07-28"), "28.07.2026");
});

Deno.test("today returns an ISO date matching the current date", () => {
  const now = new Date();
  const expected = `${now.getFullYear()}-${
    String(now.getMonth() + 1).padStart(2, "0")
  }-${String(now.getDate()).padStart(2, "0")}`;

  assertEquals(today(), expected);
});

Deno.test("formatTime returns HH:mm", () => {
  const time = formatTime(new Date());
  assertEquals(/^\d{2}:\d{2}$/.test(time), true);
});

Deno.test("assertOk returns the response when ok is true", () => {
  const response = { ok: true as const, value: 42 };
  assertEquals(assertOk(response, "context"), response);
});

Deno.test("assertOk throws with the error and context when ok is false", () => {
  const response = { ok: false, error: "boom" };
  assertThrows(
    () => assertOk(response, "MyFunction - failed"),
    Error,
    "MyFunction - failed: boom",
  );
});
