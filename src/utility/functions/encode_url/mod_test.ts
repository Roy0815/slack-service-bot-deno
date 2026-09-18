import { assertEquals } from "@std/assert";
import { SlackFunctionTester } from "deno-slack-sdk/mod.ts";
import { EncodeUrlFunction } from "./definition.ts";
import handler from "./mod.ts";

const { createContext } = SlackFunctionTester(EncodeUrlFunction);

Deno.test("encodes spaces and special characters", async () => {
  const { outputs } = await handler(
    createContext({ inputs: { input: "hello world/äöü?x=1&y=2" } }),
  );

  assertEquals(outputs?.encodedString, encodeURI("hello world/äöü?x=1&y=2"));
});

Deno.test("leaves an already-safe URL unchanged", async () => {
  const { outputs } = await handler(
    createContext({ inputs: { input: "https://example.com/path" } }),
  );

  assertEquals(outputs?.encodedString, "https://example.com/path");
});
