import { assertEquals, assertRejects } from "@std/assert";
import { stubFetch } from "./testing/fetch_stub.ts";
import { createTestGoogleServiceAccountEnv } from "./testing/test_google_key.ts";
import { getGoogleAccessToken } from "./google_service_account.ts";

function decodeJwtPart(part: string): Record<string, unknown> {
  const base64 = part.replace(/-/g, "+").replace(/_/g, "/");
  return JSON.parse(atob(base64));
}

Deno.test("getGoogleAccessToken sends a correctly-shaped signed JWT and returns the access token", async () => {
  const env = await createTestGoogleServiceAccountEnv();
  const stub = stubFetch({
    responses: { "oauth2.googleapis.com/token": { access_token: "token-123" } },
  });

  try {
    const token = await getGoogleAccessToken(env, [
      "https://example.com/scope",
    ]);
    assertEquals(token, "token-123");

    const call = stub.calls[0];
    // deno-lint-ignore no-explicit-any
    const assertion = (call.body as any).assertion as string;
    const [headerPart, claimsPart, signaturePart] = assertion.split(".");

    assertEquals(decodeJwtPart(headerPart), { alg: "RS256", typ: "JWT" });
    const claims = decodeJwtPart(claimsPart);
    assertEquals(claims.iss, env.GOOGLE_SERVICE_ACC_EMAIL);
    assertEquals(claims.scope, "https://example.com/scope");
    assertEquals(claims.aud, "https://oauth2.googleapis.com/token");
    assertEquals(signaturePart.length > 0, true);

    assertEquals(
      // deno-lint-ignore no-explicit-any
      (call.body as any).grant_type,
      "urn:ietf:params:oauth:grant-type:jwt-bearer",
    );
  } finally {
    stub.restore();
  }
});

Deno.test("getGoogleAccessToken throws with the Google error description on failure", async () => {
  const env = await createTestGoogleServiceAccountEnv();
  const stub = stubFetch({
    responses: {
      "oauth2.googleapis.com/token": {
        __status: 400,
        body: { error: "invalid_grant", error_description: "Bad key" },
      },
    },
  });

  try {
    await assertRejects(
      () => getGoogleAccessToken(env, ["scope"]),
      Error,
      "Bad key",
    );
  } finally {
    stub.restore();
  }
});
