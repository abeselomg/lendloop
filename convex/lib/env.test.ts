import { describe, it, expect, vi } from "vitest";
import { requireEnv } from "./env";
describe("requireEnv", () => {
  it("returns the value when set", () => {
    vi.stubEnv("LL_TEST_VAR", "abc");
    expect(requireEnv("LL_TEST_VAR")).toBe("abc");
  });
  it("throws a readable error when missing", () => {
    vi.stubEnv("LL_TEST_VAR", "");
    expect(() => requireEnv("LL_TEST_VAR")).toThrow("Missing environment variable LL_TEST_VAR");
  });
});
