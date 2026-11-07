// @vitest-environment node
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import { computeSignature } from "../convex/lib/signature";

const files = ["loan-notification", "overdue-reminders", "error-handler"] as const;
const dir = join(__dirname, "workflows");

type Node = {
  id: string;
  name: string;
  type: string;
  typeVersion: number;
  position: number[];
  parameters: Record<string, unknown> & { jsCode: string; options: { rawBody?: boolean }; responseMode?: string; path?: string };
  credentials?: Record<string, Record<string, unknown>>;
  retryOnFail?: boolean;
  maxTries?: number;
};
type Workflow = {
  id: string;
  name: string;
  active: boolean;
  nodes: Node[];
  connections: Record<string, { main: { node: string }[][] }>;
  settings: Record<string, unknown>;
};

const raw = (f: string) => readFileSync(join(dir, `${f}.json`), "utf8");
const load = (f: string): Workflow => JSON.parse(raw(f));

function strings(v: unknown, out: string[] = []): string[] {
  if (typeof v === "string") out.push(v);
  else if (Array.isArray(v)) v.forEach((x) => strings(x, out));
  else if (v && typeof v === "object") Object.values(v).forEach((x) => strings(x, out));
  return out;
}

describe("n8n workflow exports", () => {
  it("every workflow parses, has nodes+connections, and the two main ones point at the error handler", () => {
    const ids = { "loan-notification": "LLLoanNotify0001", "overdue-reminders": "LLOverdueRemind1", "error-handler": "LLErrorHandler01" };
    for (const f of files) {
      const w = load(f);
      expect(w.id).toBe(ids[f]);
      expect(w.active).toBe(false);
      expect(w.nodes.length).toBeGreaterThan(0);
      expect(Object.keys(w.connections).length).toBeGreaterThan(0);
      for (const n of w.nodes) {
        for (const k of ["id", "name", "type", "typeVersion", "position", "parameters"] as const) expect(n[k]).toBeDefined();
      }
      if (f !== "error-handler") {
        expect(w.settings.errorWorkflow).toBe("LLErrorHandler01");
        expect(w.settings.executionOrder).toBe("v1");
      }
    }
  });

  it("every connection target names an existing node", () => {
    for (const f of files) {
      const w = load(f);
      const names = new Set(w.nodes.map((n) => n.name));
      for (const [src, c] of Object.entries(w.connections)) {
        expect(names.has(src)).toBe(true);
        for (const outs of c.main) for (const t of outs) expect(names.has(t.node)).toBe(true);
      }
    }
  });

  it("webhook uses raw body and responds via Respond to Webhook", () => {
    const w = load("loan-notification");
    const hook = w.nodes.find((n) => n.type === "n8n-nodes-base.webhook")!;
    expect(hook.parameters.options.rawBody).toBe(true);
    expect(hook.parameters.responseMode).toBe("responseNode");
    expect(hook.parameters.path).toBe("lendloop-loan-event");
  });

  it("no secret-looking strings", () => {
    for (const f of files) {
      const s = raw(f);
      expect(s).not.toMatch(/re_[A-Za-z0-9]{10,}/);
      expect(s).not.toMatch(/(secret|token|password)["']?\s*:\s*["'][^"'$]{8,}/i);
      expect(s).not.toMatch(/Bearer [A-Za-z0-9]/);
      for (const str of strings(load(f).nodes)) {
        expect(str).not.toMatch(/re_[A-Za-z0-9]{10,}/);
        expect(str).not.toMatch(/Bearer\s+(?!\{\{)\S/);
      }
    }
  });

  it("env references use $env and credentials are referenced by name only", () => {
    for (const f of files) {
      const s = raw(f);
      expect(s).not.toMatch(/process\.env/);
      for (const n of load(f).nodes) {
        if (!n.credentials) continue;
        for (const ref of Object.values(n.credentials)) {
          expect(ref).not.toHaveProperty("data");
          expect(Object.keys(ref).sort()).toEqual(["id", "name"]);
        }
      }
    }
    const resend = load("loan-notification").nodes.find((n) => n.name === "Send via Resend")!;
    expect(resend.credentials!.httpHeaderAuth.name).toBe("Resend API");
    expect(raw("loan-notification")).toContain("$env.CONVEX_TO_N8N_SECRET");
    expect(raw("loan-notification")).toContain("$env.N8N_TO_CONVEX_SECRET");
    expect(raw("overdue-reminders")).toContain("$env.N8N_TO_CONVEX_SECRET");
    expect(raw("error-handler")).toContain("$env.N8N_TO_CONVEX_SECRET");
  });

  it("every HTTP Request node retries", () => {
    for (const f of files) {
      const https = load(f).nodes.filter((n) => n.type === "n8n-nodes-base.httpRequest");
      expect(https.length).toBeGreaterThan(0);
      for (const n of https) {
        expect(n.retryOnFail).toBe(true);
        expect(n.maxTries).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it("IF wiring: email IF reaches Resend/Mock, both reach Sign write-back; invalid signature reaches Respond 401", () => {
    const targets = (w: Workflow, name: string, out: number) => (w.connections[name]?.main[out] ?? []).map((t) => t.node);
    const reach = (w: Workflow, from: string, seen = new Set<string>()): Set<string> => {
      for (const outs of w.connections[from]?.main ?? []) for (const t of outs) if (!seen.has(t.node)) { seen.add(t.node); reach(w, t.node, seen); }
      return seen;
    };
    for (const f of ["loan-notification", "overdue-reminders"]) {
      const w = load(f);
      expect(targets(w, "Email enabled?", 0)).toEqual(["Send via Resend"]);
      expect(targets(w, "Email enabled?", 1)).toEqual(["Mock log"]);
      expect(reach(w, "Send via Resend").has("Sign write-back")).toBe(true);
      expect(reach(w, "Mock log").has("Sign write-back")).toBe(true);
      expect(w.nodes.some((n) => n.name === "Raise on severe")).toBe(true);
    }
    const w = load("loan-notification");
    expect(targets(w, "Signature valid?", 0)).toEqual(["Respond 202"]);
    expect(targets(w, "Signature valid?", 1)).toEqual(["Respond 401"]);
    expect(reach(w, "Respond 401").size).toBe(0);
  });
});

describe("severe flag is carried forward (no reaching back to unexecuted nodes)", () => {
  const code = (w: Workflow, name: string): string => w.nodes.find((n) => n.name === name)!.parameters.jsCode;

  it("Raise on severe reads Sign write-back, never Classify result; Mock log/Sign forward severe", () => {
    for (const f of ["loan-notification", "overdue-reminders"]) {
      const w = load(f);
      expect(code(w, "Raise on severe")).not.toContain("'Classify result'");
      expect(code(w, "Raise on severe")).toContain("'Sign write-back'");
      expect(code(w, "Mock log")).toMatch(/severe: false/);
      expect(code(w, "Sign write-back")).toMatch(/severe: result.severe === true/);
    }
  });

  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  const req = createRequire(import.meta.url);
  async function run(jsCode: string, input: Record<string, unknown>, executed: Record<string, Record<string, unknown>>) {
    const fn = new AsyncFunction("$input", "$env", "$", "require", "Buffer", jsCode);
    const $ = (name: string) => {
      if (!(name in executed)) throw new Error("ExpressionError: node '" + name + "' has not executed");
      return { item: { json: executed[name] } };
    };
    const $input = { item: { json: input }, first: () => ({ json: input }) };
    const out = await fn.call({ helpers: {} }, $input, { N8N_TO_CONVEX_SECRET: "test-secret" }, $, req, Buffer);
    return (Array.isArray(out) ? out[0] : out).json as Record<string, unknown> & { body: string };
  }

  it.each([
    ["loan-notification", "Build message", { to: "a@b.c", subject: "S", text: "T", eventId: "evt1", loanId: "l1" }],
    ["overdue-reminders", "Fan out", { to: "a@b.c", subject: "S", text: "T", reminderKey: "l1:2026-01-01", loanId: "l1" }],
  ])("mock path completes and signs correctly: %s", async (f, ctxNode, ctx) => {
    const w = load(f);
    const executed: Record<string, Record<string, unknown>> = { [ctxNode]: ctx };
    const mock = await run(code(w, "Mock log"), ctx, executed);
    expect(mock).toMatchObject({ status: "sent", channel: "mock", severe: false });
    const signed = await run(code(w, "Sign write-back"), mock, executed);
    executed["Sign write-back"] = signed;
    const body = JSON.parse(signed.body);
    expect(body).toMatchObject({ status: "sent", channel: "mock" });
    expect(signed.severe).toBe(false);
    const expected = "v1=" + (await computeSignature("test-secret", Number(signed.timestamp), signed.body));
    expect(signed.signature).toBe(expected);
    await expect(run(code(w, "Raise on severe"), { ok: true, created: true }, executed)).resolves.toBeDefined();
  });

  it("a severe failure is recorded and then raised", async () => {
    const w = load("loan-notification");
    const ctx = { to: "a@b.c", subject: "S", text: "T", eventId: "evt1", loanId: "l1" };
    const executed: Record<string, Record<string, unknown>> = { "Build message": ctx };
    const classified = { status: "failed", channel: "mock", error: "503 down", severe: true };
    const signed = await run(code(w, "Sign write-back"), classified, executed);
    expect(JSON.parse(signed.body)).toMatchObject({ status: "failed", error: "503 down" });
    executed["Sign write-back"] = signed;
    await expect(run(code(w, "Raise on severe"), { ok: true }, executed)).rejects.toThrow("Email provider failure: 503 down");
  });
});
