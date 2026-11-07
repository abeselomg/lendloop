export const SIGNATURE_HEADER = "x-lendloop-signature";
export const TIMESTAMP_HEADER = "x-lendloop-timestamp";
export const EVENT_ID_HEADER = "x-lendloop-event-id";
export const SIGNATURE_TOLERANCE_MS = 5 * 60 * 1000;

const PREFIX = "v1=";

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

function fromHex(hex: string): Uint8Array | null {
  if (hex.length % 2 !== 0 || !/^[0-9a-fA-F]*$/.test(hex)) return null;
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

/** HMAC-SHA256 over `${timestamp}.${body}`, lowercase hex. */
export async function computeSignature(
  secret: string,
  timestamp: number,
  body: string,
): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(`${timestamp}.${body}`));
  return toHex(sig);
}

export async function signedHeaders(
  secret: string,
  body: string,
  opts: { now?: number; eventId?: string } = {},
): Promise<Record<string, string>> {
  const ts = opts.now ?? Date.now();
  const headers: Record<string, string> = {
    [TIMESTAMP_HEADER]: String(ts),
    [SIGNATURE_HEADER]: PREFIX + (await computeSignature(secret, ts, body)),
    "content-type": "application/json",
  };
  if (opts.eventId !== undefined) headers[EVENT_ID_HEADER] = opts.eventId;
  return headers;
}

export type VerifyResult =
  | { ok: true }
  | { ok: false; reason: "missing_headers" | "bad_timestamp" | "stale" | "bad_signature" };

export async function verifySignature(
  secret: string,
  headers: Headers,
  body: string,
  now: number = Date.now(),
): Promise<VerifyResult> {
  const tsRaw = headers.get(TIMESTAMP_HEADER);
  const sigRaw = headers.get(SIGNATURE_HEADER);
  if (!tsRaw || !sigRaw) return { ok: false, reason: "missing_headers" };
  if (!/^\d+$/.test(tsRaw)) return { ok: false, reason: "bad_timestamp" };
  const ts = Number(tsRaw);
  if (!Number.isSafeInteger(ts)) return { ok: false, reason: "bad_timestamp" };
  if (Math.abs(now - ts) > SIGNATURE_TOLERANCE_MS) return { ok: false, reason: "stale" };
  if (!sigRaw.startsWith(PREFIX)) return { ok: false, reason: "bad_signature" };
  const expected = await computeSignature(secret, ts, body);
  if (!timingSafeEqualHex(expected, sigRaw.slice(PREFIX.length).toLowerCase())) {
    return { ok: false, reason: "bad_signature" };
  }
  return { ok: true };
}

export function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length || a.length % 2 !== 0) return false;
  const x = fromHex(a);
  const y = fromHex(b);
  if (!x || !y) return false;
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}
