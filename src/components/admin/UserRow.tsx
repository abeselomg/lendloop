"use client";

import { useState } from "react";
import { useAction as useConvexAction, useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import { displayFirstName } from "@convex/lib/validation";
import type { Id } from "@convex/_generated/dataModel";
import { BTN, BTN_PRIMARY, ConfirmButton, INPUT, InlineError, useAction } from "./shared";

export type AdminUser = {
  _id: Id<"users">;
  name: string;
  email: string;
  role: "admin" | "user";
  trustedLender: boolean;
  isDemo: boolean;
  adminByConfig: boolean;
  deleted: boolean;
  isMe: boolean;
};

const BADGE = "rounded-full px-2.5 py-0.5 text-xs font-medium";
const MUTED_BADGE = `${BADGE} bg-stone-200 text-stone-700 dark:bg-stone-500/20 dark:text-stone-300`;

function TrustToggle({ user, name }: { user: AdminUser; name: string }) {
  const setTrusted = useMutation(api.users.mutations.setTrustedLender);
  const { busy, error, run } = useAction();
  return (
    <>
      <InlineError>{error}</InlineError>
      <button
        type="button"
        aria-pressed={user.trustedLender}
        aria-label={`Trusted lender: ${name}`}
        disabled={busy || user.deleted}
        onClick={() => run(() => setTrusted({ userId: user._id, trusted: !user.trustedLender }))}
        className={`rounded-full px-4 py-1.5 text-sm font-medium transition-opacity focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-60 ${
          user.trustedLender ? "border border-accent bg-accent-soft text-accent" : "border border-line hover:border-accent"
        }`}
      >
        {user.trustedLender ? <span aria-hidden="true">✓ </span> : null}
        Trusted lender
      </button>
    </>
  );
}

/** Why the admin role can't be changed for this person, or null when it can. */
function roleLockReason(user: AdminUser): string | null {
  if (user.deleted) return "Deleted account";
  if (user.isDemo) return "Demo account";
  if (user.isMe) return "That's you";
  if (user.role === "admin" && user.adminByConfig) return "Set by server config";
  return null;
}

function RoleControl({ user, name }: { user: AdminUser; name: string }) {
  const setRole = useMutation(api.users.mutations.setRole);
  const { busy, error, run } = useAction();
  const lock = roleLockReason(user);

  if (user.role === "admin") {
    return (
      <div className="flex flex-wrap items-center gap-2">
        {lock ? (
          <>
            <span className="text-sm text-muted">{lock}</span>
            <button type="button" disabled title={lock} aria-label={`Remove admin: ${name}`} className={BTN}>
              Remove admin
            </button>
          </>
        ) : (
          <ConfirmButton
            label="Remove admin"
            pendingLabel="Removing…"
            ariaLabel={`Remove admin: ${name}`}
            question={`Remove admin from ${name}?`}
            confirmLabel="Remove"
            onConfirm={() => setRole({ userId: user._id, role: "user" })}
          />
        )}
      </div>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      <InlineError>{error}</InlineError>
      {lock ? <span className="text-sm text-muted">{lock}</span> : null}
      <button
        type="button"
        disabled={busy || lock !== null}
        title={lock ?? undefined}
        aria-label={`Make admin: ${name}`}
        onClick={() => run(() => setRole({ userId: user._id, role: "admin" }))}
        className={BTN}
      >
        {busy ? "Saving…" : "Make admin"}
      </button>
    </div>
  );
}

function EditName({ user, name, onClose }: { user: AdminUser; name: string; onClose: () => void }) {
  const updateName = useConvexAction(api.users.actions.updateName);
  const { busy, error, run } = useAction();
  const [first, ...rest] = (user.name || "").trim().split(/\s+/);
  const [firstName, setFirstName] = useState(first ?? "");
  const [lastName, setLastName] = useState(rest.join(" "));

  return (
    <form
      aria-label={`Edit name: ${name}`}
      className="flex w-full flex-wrap items-end gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        const ok = await run(() =>
          updateName({ userId: user._id, firstName: firstName.trim(), lastName: lastName.trim() }),
        );
        if (ok) onClose();
      }}
    >
      <label className="text-sm">
        <span className="mb-1 block text-muted">First name</span>
        <input
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          maxLength={50}
          required
          autoFocus
          className={INPUT}
        />
      </label>
      <label className="text-sm">
        <span className="mb-1 block text-muted">Last name</span>
        <input value={lastName} onChange={(e) => setLastName(e.target.value)} maxLength={50} className={INPUT} />
      </label>
      <button type="submit" disabled={busy || !firstName.trim()} className={BTN_PRIMARY}>
        {busy ? "Saving…" : "Save"}
      </button>
      <button type="button" disabled={busy} onClick={onClose} className={BTN}>
        Cancel
      </button>
      <div className="w-full">
        <InlineError>{error}</InlineError>
      </div>
    </form>
  );
}

export function UserRow({ user }: { user: AdminUser }) {
  const [editing, setEditing] = useState(false);
  const name = user.name || displayFirstName({ email: user.email });
  const locked = user.isDemo || user.deleted;

  return (
    <li className={`flex flex-wrap items-center justify-between gap-3 px-4 py-3 ${user.deleted ? "opacity-60" : ""}`}>
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-2 font-medium">
          {name}
          {user.isMe ? <span className={MUTED_BADGE}>You</span> : null}
          {user.role === "admin" ? <span className={`${BADGE} bg-accent-soft text-accent`}>Admin</span> : null}
          {user.isDemo ? <span className={MUTED_BADGE}>Demo</span> : null}
          {user.deleted ? <span className={MUTED_BADGE}>Deleted</span> : null}
        </p>
        <p className="mt-0.5 break-all text-sm text-muted">{user.email}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <TrustToggle user={user} name={name} />
        <RoleControl user={user} name={name} />
        {!editing ? (
          <button
            type="button"
            disabled={locked}
            title={locked ? (user.deleted ? "Deleted account" : "Demo account") : undefined}
            aria-label={`Edit name: ${name}`}
            onClick={() => setEditing(true)}
            className={BTN}
          >
            Edit name
          </button>
        ) : null}
      </div>
      {editing ? <EditName user={user} name={name} onClose={() => setEditing(false)} /> : null}
    </li>
  );
}
