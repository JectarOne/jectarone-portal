"use client";

import Link from "next/link";
import { useActionState } from "react";
import { requestPasswordResetAction, type MsgState } from "@/actions/account";

const initial: MsgState = {};

export default function ForgotPasswordPage() {
  const [state, formAction, pending] = useActionState(requestPasswordResetAction, initial);

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <span className="brand"><span className="mark">J</span><span>JectarOne<small>Client Portal</small></span></span>
        <h1>Reset your password</h1>
        <p className="sub">Enter your work email and we&rsquo;ll send a reset link.</p>

        {state.ok && <div className="alert alert-ok">{state.ok}</div>}
        {state.error && <div className="alert alert-error">{state.error}</div>}

        <form action={formAction}>
          <div className="field">
            <label htmlFor="email">Work email</label>
            <input id="email" name="email" type="email" autoComplete="email" required placeholder="you@company.com" />
          </div>
          <button className="btn btn-primary btn-block" type="submit" disabled={pending}>
            {pending ? "Sending…" : "Send reset link"}
          </button>
        </form>

        <p className="foot"><Link href="/login">Back to sign in</Link></p>
      </div>
    </div>
  );
}
