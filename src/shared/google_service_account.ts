const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";

function base64url(data: ArrayBuffer | string): string {
  const bytes = typeof data === "string"
    ? new TextEncoder().encode(data)
    : new Uint8Array(data);

  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);

  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(
    /=+$/,
    "",
  );
}

function importPrivateKey(pem: string): Promise<CryptoKey> {
  const pkcs8 = pem
    .replace(/\\n/g, "\n")
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s/g, "");

  const binary = atob(pkcs8);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

  return crypto.subtle.importKey(
    "pkcs8",
    bytes.buffer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

/**
 * Exchanges the Google service account credentials (GOOGLE_SERVICE_ACC_EMAIL
 * / GOOGLE_SERVICE_ACC_PRIVATE_KEY env vars) for a short-lived access token
 * via the JWT bearer OAuth2 flow - no user interaction needed. `scopes`
 * selects which Google API(s) the token is valid for (Drive, Sheets, ...).
 */
export async function getGoogleAccessToken(
  env: Record<string, string>,
  scopes: string[],
): Promise<string> {
  const clientEmail = env["GOOGLE_SERVICE_ACC_EMAIL"]!;
  const privateKey = env["GOOGLE_SERVICE_ACC_PRIVATE_KEY"]!;

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claims = {
    iss: clientEmail,
    scope: scopes.join(" "),
    aud: TOKEN_ENDPOINT,
    iat: now,
    exp: now + 3600,
  };

  const unsignedToken = `${base64url(JSON.stringify(header))}.${
    base64url(JSON.stringify(claims))
  }`;

  const key = await importPrivateKey(privateKey);
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(unsignedToken),
  );

  const jwt = `${unsignedToken}.${base64url(signature)}`;

  const response = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      `Google OAuth2 Token-Anfrage fehlgeschlagen: ${
        data.error_description ?? data.error
      }`,
    );
  }

  return data.access_token as string;
}
