import { v } from "convex/values";
import { internal } from "../_generated/api";
import { internalAction } from "../_generated/server";
import { signedHeaders } from "../lib/signature";

export const deliverEvent = internalAction({
  args: { eventId: v.id("automationEvents") },
  handler: async (ctx, { eventId }): Promise<null> => {
    const result = await ctx.runQuery(internal.automation.internal.getEventPayload, { eventId });
    if (result.kind === "skip") return null;
    if (result.kind === "orphaned") {
      await ctx.runMutation(internal.automation.internal.markAttemptFailed, {
        eventId,
        error: "Loan or recipient no longer exists",
        terminal: true,
      });
      return null;
    }
    const url = process.env.N8N_LOAN_EVENT_WEBHOOK_URL;
    const secret = process.env.CONVEX_TO_N8N_SECRET;
    const missing = !url ? "N8N_LOAN_EVENT_WEBHOOK_URL" : !secret ? "CONVEX_TO_N8N_SECRET" : null;
    if (missing || !url || !secret) {
      await ctx.runMutation(internal.automation.internal.markAttemptFailed, {
        eventId,
        error: `Missing environment variable ${missing}`,
        terminal: true,
      });
      return null;
    }
    const body = JSON.stringify(result.payload);
    const headers = await signedHeaders(secret, body, { eventId });
    let res: Response;
    try {
      res = await fetch(url, { method: "POST", headers, body });
    } catch (error) {
      await ctx.runMutation(internal.automation.internal.markAttemptFailed, {
        eventId,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
    if (res.ok) {
      await ctx.runMutation(internal.automation.internal.markDelivered, { eventId });
    } else {
      await ctx.runMutation(internal.automation.internal.markAttemptFailed, { eventId, error: `HTTP ${res.status}` });
    }
    return null;
  },
});
