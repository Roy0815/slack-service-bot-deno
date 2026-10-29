import { assertEquals } from "@std/assert";
import { SlackFunctionTester } from "deno-slack-sdk/mod.ts";
import { EncodeUrlFunction } from "./definition.ts";
import handler from "./mod.ts";

const { createContext } = SlackFunctionTester(EncodeUrlFunction);

async function encode(input: string): Promise<string | undefined> {
  const { outputs } = await handler(createContext({ inputs: { input } }));
  return outputs?.encodedString;
}

Deno.test("encodes ampersand so it does not break the query string", async () => {
  assertEquals(await encode("Tom & Jerry"), "Tom%20%26%20Jerry");
});

Deno.test("encodes URL reserved characters", async () => {
  assertEquals(
    await encode(";/?:@&=+$,#"),
    "%3B%2F%3F%3A%40%26%3D%2B%24%2C%23",
  );
});

Deno.test("encodes a full URL when used as a parameter value", async () => {
  assertEquals(
    await encode("https://example.com/path?x=1&y=2"),
    "https%3A%2F%2Fexample.com%2Fpath%3Fx%3D1%26y%3D2",
  );
});

Deno.test("encodes spaces and umlauts", async () => {
  assertEquals(
    await encode("hello world äöü ß"),
    "hello%20world%20%C3%A4%C3%B6%C3%BC%20%C3%9F",
  );
});

Deno.test("encodes percent sign so it is not read as an escape", async () => {
  assertEquals(await encode("100%"), "100%25");
  assertEquals(await encode("%26"), "%2526");
});

Deno.test("encodes emoji (surrogate pairs)", async () => {
  assertEquals(await encode("👍"), "%F0%9F%91%8D");
});

Deno.test("leaves unreserved characters unchanged", async () => {
  assertEquals(await encode("AZaz09-_.!~*'()"), "AZaz09-_.!~*'()");
});

Deno.test("returns an empty string for empty input", async () => {
  assertEquals(await encode(""), "");
});

Deno.test("matches encodeURIComponent for arbitrary user input", async () => {
  const input = "Müller & Söhne: 50% off? #deal=yes/no+maybe";
  assertEquals(await encode(input), encodeURIComponent(input));
});
