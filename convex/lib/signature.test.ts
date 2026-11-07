import { describe, expect, it } from "vitest";
import {
  EVENT_ID_HEADER,
  SIGNATURE_HEADER,
  SIGNATURE_TOLERANCE_MS,
  TIMESTAMP_HEADER,
  computeSignature,
  signedHeaders,
  timingSafeEqualHex,
  verifySignature,
} from "./signature";

const NOW = 1700000000000;
const BODY = '{"a":1}';

describe("signature", () => {
  it("computeSignature matches known vector", async () => {
    // node -e "console.log(require('crypto').createHmac('sha256','secret').update('1700000000000.{\"a\":1}').digest('hex'))"
    expect(await computeSignature("secret", NOW, BODY)).toBe(
      "4ef2732b0d632a6897af3a6d02a6de287f60d6c5f15dabdb0ceb045a34e3c5a7",
    );
  });

  it("round-trips signedHeaders -> verifySignature", async () => {
    const h = await signedHeaders("secret", BODY, { now: NOW, eventId: "evt1" });
    expect(h["content-type"]).toBe("application/json");
    expect(h[EVENT_ID_HEADER]).toBe("evt1");
    expect(h[SIGNATURE_HEADER].startsWith("v1=")).toBe(true);
    expect(await verifySignature("secret", new Headers(h), BODY, NOW)).toEqual({ ok: true });
  });

  it("omits event id when not given", async () => {
    const h = await signedHeaders("secret", BODY, { now: NOW });
    expect(EVENT_ID_HEADER in h).toBe(false);
  });

  it("rejects tampered body", async () => {
    const h = await signedHeaders("secret", BODY, { now: NOW });
    expect(await verifySignature("secret", new Headers(h), '{"a":2}', NOW)).toEqual({
      ok: false,
      reason: "bad_signature",
    });
  });

  it("rejects wrong secret", async () => {
    const h = await signedHeaders("secret", BODY, { now: NOW });
    expect(await verifySignature("other", new Headers(h), BODY, NOW)).toEqual({
      ok: false,
      reason: "bad_signature",
    });
  });

  it("rejects header without v1= prefix", async () => {
    const h = await signedHeaders("secret", BODY, { now: NOW });
    h[SIGNATURE_HEADER] = h[SIGNATURE_HEADER].slice(3);
    expect(await verifySignature("secret", new Headers(h), BODY, NOW)).toEqual({
      ok: false,
      reason: "bad_signature",
    });
  });

  it("rejects stale timestamp (6 minutes old)", async () => {
    const h = await signedHeaders("secret", BODY, { now: NOW });
    expect(await verifySignature("secret", new Headers(h), BODY, NOW + 6 * 60 * 1000)).toEqual({
      ok: false,
      reason: "stale",
    });
  });

  it("rejects future timestamp beyond tolerance", async () => {
    const h = await signedHeaders("secret", BODY, { now: NOW + SIGNATURE_TOLERANCE_MS + 1 });
    expect(await verifySignature("secret", new Headers(h), BODY, NOW)).toEqual({
      ok: false,
      reason: "stale",
    });
  });

  it("accepts timestamp exactly at tolerance", async () => {
    const h = await signedHeaders("secret", BODY, { now: NOW });
    expect(
      await verifySignature("secret", new Headers(h), BODY, NOW + SIGNATURE_TOLERANCE_MS),
    ).toEqual({ ok: true });
  });

  it("rejects missing headers and non-numeric timestamp", async () => {
    expect(await verifySignature("secret", new Headers(), BODY, NOW)).toEqual({
      ok: false,
      reason: "missing_headers",
    });
    expect(
      await verifySignature(
        "secret",
        new Headers({ [TIMESTAMP_HEADER]: "abc", [SIGNATURE_HEADER]: "v1=00" }),
        BODY,
        NOW,
      ),
    ).toEqual({ ok: false, reason: "bad_timestamp" });
    expect(
      await verifySignature(
        "secret",
        new Headers({ [TIMESTAMP_HEADER]: "1.5", [SIGNATURE_HEADER]: "v1=00" }),
        BODY,
        NOW,
      ),
    ).toEqual({ ok: false, reason: "bad_timestamp" });
  });

  it("timingSafeEqualHex", () => {
    expect(timingSafeEqualHex("abcd", "abcd")).toBe(true);
    expect(timingSafeEqualHex("abcd", "abce")).toBe(false);
    expect(timingSafeEqualHex("abcd", "abcdef")).toBe(false);
    expect(timingSafeEqualHex("abc", "abc")).toBe(false);
  });
});
