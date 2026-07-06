"use client";

import { useActionState } from "react";
import { createApiTokenAction, type TokenState } from "@/actions/api-tokens";

const init: TokenState = {};

export function ApiTokenForm() {
  const [state, action, pending] = useActionState(createApiTokenAction, init);
  return (
    <div className="card" style={{ marginBottom: "1rem" }}>
      <h3 className="chart-title">Create API token</h3>
      {state.error && <div className="alert alert-error">{state.error}</div>}
      {state.created && (
        <div className="alert alert-ok">
          <div style={{ marginBottom: 6 }}>Copy your token now — it won&rsquo;t be shown again:</div>
          <code data-testid="new-token" style={{ wordBreak: "break-all", fontSize: "0.85rem" }}>{state.created}</code>
        </div>
      )}
      <form action={action} style={{ display: "flex", gap: "0.5rem", alignItems: "flex-end", flexWrap: "wrap" }}>
        <div className="field" style={{ margin: 0, flex: 1, minWidth: 220 }}>
          <label htmlFor="name">Token name</label>
          <input id="name" name="name" placeholder="CI pipeline" required />
        </div>
        <button className="btn btn-primary" type="submit" disabled={pending}>{pending ? "Creating…" : "Create token"}</button>
      </form>
      <p className="muted" style={{ fontSize: "0.8rem", marginTop: "0.6rem" }}>
        Use as <code>Authorization: Bearer &lt;token&gt;</code> against <code>/api/v1</code>. Admins only.
      </p>
    </div>
  );
}
