import { SignatureProvider } from "./types.ts";
import { createDocuSealProvider } from "./docuseal.ts";

/**
 * The single switch point for the signature service.
 *
 * Every function under src/signatures/functions goes through here and only
 * ever sees the provider-agnostic types from types.ts. To move to another
 * service, add a sibling implementation next to docuseal.ts and change the
 * one line below.
 */
export function getSignatureProvider(
  env: Record<string, string>,
): SignatureProvider {
  return createDocuSealProvider(env);
}
