function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = "";
  for (const byte of new Uint8Array(buffer)) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

/**
 * Generates a throwaway RSA keypair and returns fake GOOGLE_SERVICE_ACC_*
 * env vars in the same shape production .env files use (PEM with escaped
 * "\n" line breaks), so tests can exercise the real JWT-signing path in
 * google_service_account.ts without a real Google service account.
 */
export async function createTestGoogleServiceAccountEnv(): Promise<
  Record<string, string>
> {
  const keyPair = await crypto.subtle.generateKey(
    {
      name: "RSASSA-PKCS1-v1_5",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["sign", "verify"],
  );

  const pkcs8 = await crypto.subtle.exportKey("pkcs8", keyPair.privateKey);
  const base64 = arrayBufferToBase64(pkcs8);
  const lines = base64.match(/.{1,64}/g) ?? [base64];
  const pem = `-----BEGIN PRIVATE KEY-----\\n${
    lines.join("\\n")
  }\\n-----END PRIVATE KEY-----\\n`;

  return {
    GOOGLE_SERVICE_ACC_EMAIL: "test@test.iam.gserviceaccount.com",
    GOOGLE_SERVICE_ACC_PRIVATE_KEY: pem,
  };
}
