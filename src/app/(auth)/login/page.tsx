"use client";

import Link from "next/link";
import { useActionState } from "react";
import { loginAction, type ActionState } from "@/actions/auth";

const initial: ActionState = {};

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(loginAction, initial);

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <span className="brand"><span className="mark">J</span><span>JectarOne<small>Client Portal</small></span></span>
        <h1>Sign in</h1>
        <p className="sub">Access your assessments, findings, and reports.</p>

        {state.error && <div className="alert alert-error">{state.error}</div>}

        <form action={formAction}>
          <div className="field">
            <label htmlFor="email">Work email</label>
            <input id="email" name="email" type="email" autoComplete="email" required placeholder="you@company.com" />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input id="password" name="password" type="password" autoComplete="current-password" required placeholder="Your password" />
          </div>
          <button className="btn btn-primary btn-block" type="submit" disabled={pending}>
            {pending ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="foot">No account yet? <Link href="/signup">Create an organization</Link></p>
      </div>
    </div>
  );
}
