// Svix webhook verification (what Clerk uses), without the svix library.
// Signed content is `${id}.${timestamp}.${body}`, HMAC-SHA256 keyed with the base64-decoded `whsec_` secret.
export const SVIX_TOLERANCE_MS = 5 * 60 * 1000;

export type SvixResult =
  | { ok: true }
  | { ok: false; reason: "missing_headers" | "bad_secret" | "bad_timestamp" | "stale" | "bad_signature" };

function base64ToBytes(b64: string): Uint8Array | null {
  try {
    const bin = atob(b64);
    return Uint8Array.from(bin, (c) => c.charCodeAt(0));
  } catch {
    return null;
  }
}

function bytesToBase64(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Base64 HMAC-SHA256 of `${id}.${timestamp}.${body}`; null when the secret is not valid base64. */
export async function svixSignature(
  secret: string,
  id: string,
  timestamp: string,
  body: string,
): Promise<string | null> {
  const keyBytes = base64ToBytes(secret.startsWith("whsec_") ? secret.slice(6) : secret);
  if (!keyBytes) return null;
  const key = await crypto.subtle.importKey("raw", keyBytes as BufferSource, { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
  ]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${id}.${timestamp}.${body}`));
  return bytesToBase64(new Uint8Array(sig));
}

export async function verifySvix(
  secret: string,
  headers: Headers,
  body: string,
  now: number = Date.now(),
): Promise<SvixResult> {
  const id = headers.get("svix-id");
  const timestamp = headers.get("svix-timestamp");
  const signatures = headers.get("svix-signature");
  if (!id || !timestamp || !signatures) return { ok: false, reason: "missing_headers" };
  if (!/^\d+$/.test(timestamp)) return { ok: false, reason: "bad_timestamp" };
  const seconds = Number(timestamp);
  if (!Number.isSafeInteger(seconds)) return { ok: false, reason: "bad_timestamp" };
  if (Math.abs(now - seconds * 1000) > SVIX_TOLERANCE_MS) return { ok: false, reason: "stale" };
  const expected = await svixSignature(secret, id, timestamp, body);
  if (expected === null) return { ok: false, reason: "bad_secret" };
  for (const entry of signatures.split(" ")) {
    const [version, sig] = entry.split(",");
    if (version === "v1" && sig && timingSafeEqual(expected, sig)) return { ok: true };
  }
  return { ok: false, reason: "bad_signature" };
}
