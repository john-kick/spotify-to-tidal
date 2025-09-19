import crypto from "crypto";

type PKCEChallenge = { codeVerifier: string; codeChallenge: string };

export function generateRandomString(length: number = 64) {
  return crypto.randomBytes(length).toString("hex");
}

export function base64encode(client_id: string, client_secret: string) {
  return btoa(`${client_id}:${client_secret}`);
}

export async function generateS256challenge(): Promise<PKCEChallenge> {
  const array = new Uint8Array(64);
  crypto.getRandomValues(array); // browser crypto
  const codeVerifier = btoa(String.fromCharCode(...array))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "")
    .substring(0, 128); // PKCE allows up to 128 chars

  // Step 2: SHA-256 hash, then Base64URL encode -> code_challenge
  const encoder = new TextEncoder();
  const data = encoder.encode(codeVerifier);
  const digest = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(digest));
  const base64 = btoa(String.fromCharCode(...hashArray))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  return { codeVerifier, codeChallenge: base64 };
}
