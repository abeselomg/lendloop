import { describe, expect, it } from "vitest";
import { describeActivity, type Perspective } from "./activity";

const asBorrower: Perspective = { viewerRole: "borrower", borrowerName: "Alice", lenderName: "Bob" };
const asLender: Perspective = { viewerRole: "lender", borrowerName: "Alice", lenderName: "Bob" };
const asAdmin: Perspective = { viewerRole: "admin", borrowerName: "Alice", lenderName: "Bob" };

const sent = (eventType: string) => ({ kind: "notification_sent" as const, message: "x", meta: { eventType } });

describe("describeActivity", () => {
  it("hides the internal hand-off to n8n", () => {
    expect(describeActivity({ kind: "webhook_delivered", message: "Request notification handed to n8n" }, asBorrower)).toBeNull();
  });

  it("words a request notification from each side", () => {
    expect(describeActivity(sent("loan.requested"), asBorrower)).toBe("Bob was notified about your request");
    expect(describeActivity(sent("loan.requested"), asLender)).toBe("You were notified about this request");
    expect(describeActivity(sent("loan.requested"), asAdmin)).toBe("Bob was notified about Alice's request");
  });

  it("words decisions by the lender", () => {
    expect(describeActivity(sent("loan.approved"), asBorrower)).toBe("You were notified that Bob approved it");
    expect(describeActivity(sent("loan.approved"), asLender)).toBe("Alice was notified that you approved it");
    expect(describeActivity(sent("loan.declined"), asBorrower)).toBe("You were notified that Bob declined it");
    expect(describeActivity(sent("loan.returned"), asLender)).toBe("Alice was notified that you marked it returned");
  });

  it("words a cancellation by the borrower", () => {
    expect(describeActivity(sent("loan.cancelled"), asLender)).toBe("You were notified that Alice cancelled the request");
    expect(describeActivity(sent("loan.cancelled"), asBorrower)).toBe("Bob was notified that you cancelled the request");
  });

  it("falls back to the label at the start of older messages without metadata", () => {
    expect(describeActivity({ kind: "notification_sent", message: "Approval mock notification sent" }, asBorrower)).toBe(
      "You were notified that Bob approved it",
    );
  });

  it("explains failures without technical detail", () => {
    expect(
      describeActivity({ kind: "notification_failed", message: "Request email failed: 422", meta: { eventType: "loan.requested" } }, asBorrower),
    ).toBe("Couldn't notify Bob about your request");
    expect(describeActivity({ kind: "webhook_failed", message: "Could not reach n8n after 5 attempts: 503", meta: { eventType: "loan.approved" } }, asLender)).toBe(
      "Couldn't notify Alice that you approved it",
    );
    expect(describeActivity({ kind: "notification_failed", message: "Reminder failed: timeout" }, asBorrower)).toBe(
      "Couldn't send the return reminder",
    );
    expect(describeActivity({ kind: "workflow_error", message: "LendLoop – Loan notification: boom" }, asLender)).toBe(
      "A notification ran into a problem. The admin has been alerted.",
    );
  });

  it("words reminders", () => {
    expect(describeActivity({ kind: "reminder_sent", message: "Reminder sent to borrower" }, asBorrower)).toBe(
      "You were reminded to return it",
    );
    expect(describeActivity({ kind: "reminder_sent", message: "Reminder sent to borrower" }, asLender)).toBe(
      "Alice was reminded to return it",
    );
  });

  it("still says something sensible when the event type is unknown", () => {
    expect(describeActivity({ kind: "notification_sent", message: "something" }, asBorrower)).toBe("A notification was sent");
  });
});
