"use client";

import Link from "next/link";
import { useActionState } from "react";
import { resetPasswordAction, type MsgState } from "@/actions/account";

const initial: MsgState = {};

export function ResetForm({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState(resetPasswordAction, initial);

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <span className="brand"><span className="mark">J</span><span>JectarOne<small>Client Portal</small></span></span>
        <h1>Choose a new password</h1>

        {!token && <div className="alert alert-error">Missing reset token. Use the link from your email.</div>}
        {state.error && <div className="alert alert-error">{state.error}</div>}

        <form action={formAction}>
          <input type="hidden" name="token" value={token} />
          <div className="field">
            <label htmlFor="password">New password</label>
            <input id="password" name="password" type="password" autoComplete="new-password" required minLength={8} placeholder="At least 8 characters" />
          </div>
          <button className="btn btn-primary btn-block" type="submit" disabled={pending || !token}>
            {pending ? "Saving…" : "Set new password"}
          </button>
        </form>

        <p className="foot"><Link href="/login">Back to sign in</Link></p>
      </div>
    </div>
  );
}
