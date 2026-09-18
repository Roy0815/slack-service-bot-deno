import { assertEquals } from "@std/assert";
import { SlackFunctionTester } from "deno-slack-sdk/mod.ts";
import { FormatDateFunction } from "./definition.ts";
import handler from "./mod.ts";

const { createContext } = SlackFunctionTester(FormatDateFunction);

Deno.test("formats an ISO date using the given format string", async () => {
  const { outputs } = await handler(
    createContext({ inputs: { date: "2026-07-28", format: "DD.MM.YYYY" } }),
  );

  assertEquals(outputs?.formattedDate, "28.07.2026");
});

Deno.test("supports repeated placeholders and reordering", async () => {
  const { outputs } = await handler(
    createContext({
      inputs: { date: "2026-07-28", format: "YYYY/MM/DD (YYYY)" },
    }),
  );

  assertEquals(outputs?.formattedDate, "2026/07/28 (2026)");
});
