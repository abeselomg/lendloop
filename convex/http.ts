import { httpRouter } from "convex/server";
import { ConvexError } from "convex/values";
import { internal } from "./_generated/api";
import { httpAction } from "./_generated/server";
import { verifySignature } from "./lib/signature";
import { todayUtc } from "./lib/validation";

const http = httpRouter();

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

export async function verified(
  request: Request,
): Promise<{ ok: true; body: string } | { ok: false; response: Response }> {
  const secret = process.env.N8N_TO_CONVEX_SECRET;
  if (!secret) return { ok: false, response: json({ error: "N8N_TO_CONVEX_SECRET not configured" }, 503) };
  const body = await request.text();
  const result = await verifySignature(secret, request.headers, body);
  if (!result.ok) return { ok: false, response: json({ error: result.reason }, 401) };
  return { ok: true, body };
}

type FieldType = "string" | "optionalString";

/** Parse a JSON object body and check field types; returns the object or a 400 Response. */
function parseBody(body: string, fields: Record<string, FieldType>): Record<string, unknown> | Response {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return json({ error: "Body must be a JSON object" }, 400);
  }
  const obj = parsed as Record<string, unknown>;
  for (const [name, type] of Object.entries(fields)) {
    const val = obj[name];
    if (type === "string" && typeof val !== "string") return json({ error: `Missing or invalid field: ${name}` }, 400);
    if (type === "optionalString" && val !== undefined && val !== null && typeof val !== "string") {
      return json({ error: `Invalid field: ${name}` }, 400);
    }
  }
  return obj;
}

function badStatus(obj: Record<string, unknown>): Response | null {
  return obj.status === "sent" || obj.status === "failed"
    ? null
    : json({ error: "Missing or invalid field: status (must be sent or failed)" }, 400);
}

const opt = (x: unknown) => (typeof x === "string" ? x : undefined);

async function guarded(fn: () => Promise<{ created: boolean }>): Promise<Response> {
  try {
    const { created } = await fn();
    return json({ ok: true, created });
  } catch (e) {
    if (e instanceof ConvexError && typeof e.data === "string") return json({ error: e.data }, 400);
    throw e;
  }
}

http.route({
  path: "/n8n/overdue-loans",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const v = await verified(request);
    if (!v.ok) return v.response;
    const today = todayUtc();
    const loans = await ctx.runQuery(internal.n8n.overdueLoans, { today });
    return json({ today, loans });
  }),
});

http.route({
  path: "/n8n/notifications",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const v = await verified(request);
    if (!v.ok) return v.response;
    const o = parseBody(v.body, {
      eventId: "string",
      channel: "string",
      sentAt: "string",
      providerMessageId: "optionalString",
      error: "optionalString",
    });
    if (o instanceof Response) return o;
    const bad = badStatus(o);
    if (bad) return bad;
    return guarded(() =>
      ctx.runMutation(internal.n8n.recordNotification, {
        eventId: o.eventId as string,
        channel: o.channel as string,
        status: o.status as "sent" | "failed",
        providerMessageId: opt(o.providerMessageId),
        error: opt(o.error),
        sentAt: o.sentAt as string,
      }),
    );
  }),
});

http.route({
  path: "/n8n/reminders",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const v = await verified(request);
    if (!v.ok) return v.response;
    const o = parseBody(v.body, {
      reminderKey: "string",
      loanId: "string",
      channel: "string",
      sentAt: "string",
      error: "optionalString",
    });
    if (o instanceof Response) return o;
    const bad = badStatus(o);
    if (bad) return bad;
    return guarded(() =>
      ctx.runMutation(internal.n8n.recordReminder, {
        reminderKey: o.reminderKey as string,
        loanId: o.loanId as string,
        channel: o.channel as string,
        status: o.status as "sent" | "failed",
        error: opt(o.error),
        sentAt: o.sentAt as string,
      }),
    );
  }),
});

http.route({
  path: "/n8n/automation-errors",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const v = await verified(request);
    if (!v.ok) return v.response;
    const o = parseBody(v.body, {
      executionId: "string",
      workflowName: "string",
      message: "string",
      failedAt: "string",
      nodeName: "optionalString",
      loanId: "optionalString",
    });
    if (o instanceof Response) return o;
    return guarded(() =>
      ctx.runMutation(internal.n8n.recordWorkflowError, {
        executionId: o.executionId as string,
        workflowName: o.workflowName as string,
        nodeName: opt(o.nodeName),
        message: o.message as string,
        failedAt: o.failedAt as string,
        loanId: opt(o.loanId),
      }),
    );
  }),
});

export default http;
