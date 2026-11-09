import { describe, expect, it } from "vitest";
import { SVIX_TOLERANCE_MS, svixSignature, verifySvix } from "./svix";

// Vector from the Svix docs.
const SECRET = "whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw";
const ID = "msg_p5jXN8AQM9LWM0D4loKWxJek";
const TS = "1614265330";
const BODY = '{"test": 2432232314}';
const SIG = "g0hM9SsE+OTPJTGt/tmIKtSyZlE3uFJELVlNIOLJ1OE=";
const NOW = 1614265330 * 1000;

const headers = (over: Record<string, string> = {}) =>
  new Headers({ "svix-id": ID, "svix-timestamp": TS, "svix-signature": `v1,${SIG}`, ...over });

describe("svix", () => {
  it("matches the known vector", async () => {
    expect(await svixSignature(SECRET, ID, TS, BODY)).toBe(SIG);
  });

  it("matches an independently computed WebCrypto signature", async () => {
    const raw = Uint8Array.from(atob("c2VjcmV0LWJ5dGVz"), (c) => c.charCodeAt(0));
    const key = await crypto.subtle.importKey("raw", raw, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`a.1.b`));
    const expected = btoa(String.fromCharCode(...new Uint8Array(mac)));
    expect(await svixSignature("whsec_c2VjcmV0LWJ5dGVz", "a", "1", "b")).toBe(expected);
  });

  it("accepts a valid signature, including among several entries", async () => {
    expect(await verifySvix(SECRET, headers(), BODY, NOW)).toEqual({ ok: true });
    const multi = headers({ "svix-signature": `v1,AAAA v2,${SIG} v1,${SIG}` });
    expect(await verifySvix(SECRET, multi, BODY, NOW)).toEqual({ ok: true });
  });

  it("rejects tampered body, wrong secret, wrong version and bad base64", async () => {
    expect(await verifySvix(SECRET, headers(), BODY + " ", NOW)).toEqual({ ok: false, reason: "bad_signature" });
    expect(await verifySvix("whsec_" + btoa("other"), headers(), BODY, NOW)).toEqual({
      ok: false,
      reason: "bad_signature",
    });
    expect(await verifySvix(SECRET, headers({ "svix-signature": `v2,${SIG}` }), BODY, NOW)).toEqual({
      ok: false,
      reason: "bad_signature",
    });
    expect(await verifySvix("whsec_***", headers(), BODY, NOW)).toEqual({ ok: false, reason: "bad_secret" });
  });

  it("rejects missing headers and bad or stale timestamps", async () => {
    const h = headers();
    h.delete("svix-id");
    expect(await verifySvix(SECRET, h, BODY, NOW)).toEqual({ ok: false, reason: "missing_headers" });
    expect(await verifySvix(SECRET, headers({ "svix-timestamp": "abc" }), BODY, NOW)).toEqual({
      ok: false,
      reason: "bad_timestamp",
    });
    expect(await verifySvix(SECRET, headers(), BODY, NOW + SVIX_TOLERANCE_MS + 1000)).toEqual({
      ok: false,
      reason: "stale",
    });
    expect(await verifySvix(SECRET, headers(), BODY, NOW - SVIX_TOLERANCE_MS - 1000)).toEqual({
      ok: false,
      reason: "stale",
    });
  });
});
