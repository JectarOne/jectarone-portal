"use client";

import { useActionState } from "react";
import { addMemberAction, type TeamState } from "@/actions/team";
import { ROLES } from "@/lib/rbac";

const initial: TeamState = {};

export function AddMemberForm({ canGrantOwner }: { canGrantOwner: boolean }) {
  const [state, formAction, pending] = useActionState(addMemberAction, initial);

  return (
    <div className="card" style={{ marginBottom: "1.2rem" }}>
      <h2 style={{ fontSize: "1.05rem", marginBottom: "0.9rem" }}>Add a member</h2>

      {state.error && <div className="alert alert-error">{state.error}</div>}
      {state.ok && <div className="alert alert-ok">{state.ok}</div>}

      <form action={formAction}>
        <div className="grid grid-3">
          <div className="field">
            <label htmlFor="m-name">Name</label>
            <input id="m-name" name="name" type="text" required placeholder="Full name" />
          </div>
          <div className="field">
            <label htmlFor="m-email">Email</label>
            <input id="m-email" name="email" type="email" required placeholder="person@company.com" />
          </div>
          <div className="field">
            <label htmlFor="m-role">Role</label>
            <select id="m-role" name="role" defaultValue="MEMBER">
              {ROLES.filter((r) => r !== "OWNER" || canGrantOwner).map((r) => (
                <option key={r} value={r}>{r.charAt(0) + r.slice(1).toLowerCase()}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="field">
          <label htmlFor="m-password">Temporary password</label>
          <input id="m-password" name="password" type="text" required minLength={8} placeholder="Share this with them; they can change it later" />
        </div>
        <button className="btn btn-primary" type="submit" disabled={pending}>
          {pending ? "Adding…" : "Add member"}
        </button>
      </form>
    </div>
  );
}
