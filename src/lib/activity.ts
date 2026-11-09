// Turns automation log rows into plain sentences for the people on a loan. The admin console keeps the raw,
// technical messages; borrowers and lenders only need to know who was told what.
import { EVENT_LABELS, type EventType, type LogKind } from "../../convex/lib/validation";

export type Perspective = { viewerRole: "borrower" | "lender" | "admin"; borrowerName: string; lenderName: string };
type Entry = { kind: LogKind; message: string; meta?: Record<string, string | number | boolean> };
type Party = "borrower" | "lender";

// Who gets notified, and who did the thing they are told about.
const RECIPIENT: Record<EventType, Party> = {
  "loan.requested": "lender",
  "loan.cancelled": "lender",
  "loan.approved": "borrower",
  "loan.declined": "borrower",
  "loan.returned": "borrower",
};
const other = (p: Party): Party => (p === "borrower" ? "lender" : "borrower");

export function eventTypeOf(entry: Entry): EventType | null {
  const fromMeta = entry.meta?.eventType;
  if (typeof fromMeta === "string" && fromMeta in EVENT_LABELS) return fromMeta as EventType;
  // Rows written before the event type was stored start with its label ("Approval mock notification sent").
  for (const [type, label] of Object.entries(EVENT_LABELS)) {
    if (entry.message.startsWith(`${label} `)) return type as EventType;
  }
  return null;
}

export function describeActivity(entry: Entry, p: Perspective): string | null {
  const isViewer = (party: Party) => p.viewerRole === party;
  const name = (party: Party) => (party === "borrower" ? p.borrowerName : p.lenderName);
  const subject = (party: Party) => (isViewer(party) ? "You were" : `${name(party)} was`);
  const object = (party: Party) => (isViewer(party) ? "you" : name(party));

  // What the recipient was told, phrased around the person who acted.
  const about = (type: EventType): string => {
    const actor = other(RECIPIENT[type]);
    const who = object(actor);
    switch (type) {
      case "loan.requested":
        if (isViewer(RECIPIENT[type])) return "about this request";
        return isViewer(actor) ? "about your request" : `about ${name(actor)}'s request`;
      case "loan.approved":
        return `that ${who} approved it`;
      case "loan.declined":
        return `that ${who} declined it`;
      case "loan.returned":
        return `that ${who} marked it returned`;
      case "loan.cancelled":
        return `that ${who} cancelled the request`;
    }
  };

  switch (entry.kind) {
    case "webhook_delivered":
      return null; // an internal step; the "notified" line that follows is what matters
    case "notification_sent": {
      const type = eventTypeOf(entry);
      return type ? `${subject(RECIPIENT[type])} notified ${about(type)}` : "A notification was sent";
    }
    case "notification_failed":
    case "webhook_failed": {
      if (entry.message.startsWith("Reminder")) return "Couldn't send the return reminder";
      const type = eventTypeOf(entry);
      return type ? `Couldn't notify ${object(RECIPIENT[type])} ${about(type)}` : "A notification couldn't be sent";
    }
    case "reminder_sent":
      return `${subject("borrower")} reminded to return it`;
    case "workflow_error":
      return "A notification ran into a problem. The admin has been alerted.";
  }
}
