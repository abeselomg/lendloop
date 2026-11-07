// @vitest-environment node
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const files = ["loan-notification", "overdue-reminders", "error-handler"] as const;
const dir = join(__dirname, "workflows");

type Node = {
  id: string;
  name: string;
  type: string;
  typeVersion: number;
  position: number[];
  parameters: Record<string, any>;
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
});
