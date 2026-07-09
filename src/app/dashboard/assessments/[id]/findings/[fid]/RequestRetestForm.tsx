"use client";

import { useActionState } from "react";
import type { RetestState } from "@/actions/retest";

export function RequestRetestForm({
  action, members,
}: {
  action: (prev: RetestState, fd: FormData) => Promise<RetestState>;
  members: { id: string; name: string }[];
}) {
  const [state, formAction, pending] = useActionState(action, {} as RetestState);

  return (
    <form action={formAction} className="inline-form" style={{ flexWrap: "wrap" }}>
      {state.error && <div className="alert alert-error" style={{ width: "100%" }}>{state.error}</div>}
      <label htmlFor="rt-assignee" className="muted" style={{ fontSize: "0.82rem" }}>Assign</label>
      <select id="rt-assignee" name="assignedToId" defaultValue="" aria-label="Assign retest to">
        <option value="">— unassigned —</option>
        {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
      </select>
      <label htmlFor="rt-due" className="muted" style={{ fontSize: "0.82rem" }}>Due</label>
      <input id="rt-due" name="dueDate" type="date" aria-label="Retest due date" />
      <button className="btn btn-primary" type="submit" disabled={pending}>{pending ? "Requesting…" : "Request retest"}</button>
    </form>
  );
}
