"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signupAction, type ActionState } from "@/actions/auth";

const initial: ActionState = {};

export default function SignupPage() {
  const [state, formAction, pending] = useActionState(signupAction, initial);

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <span className="brand"><span className="mark">J</span><span>JectarOne<small>Client Portal</small></span></span>
        <h1>Create your organization</h1>
        <p className="sub">You'll be the owner. You can add colleagues afterwards.</p>

        {state.error && <div className="alert alert-error">{state.error}</div>}

        <form action={formAction}>
          <div className="field">
            <label htmlFor="name">Your name</label>
            <input id="name" name="name" type="text" autoComplete="name" required placeholder="Full name" />
          </div>
          <div className="field">
            <label htmlFor="organization">Organization name</label>
            <input id="organization" name="organization" type="text" autoComplete="organization" required placeholder="Your company" />
          </div>
          <div className="field">
            <label htmlFor="email">Work email</label>
            <input id="email" name="email" type="email" autoComplete="email" required placeholder="you@company.com" />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input id="password" name="password" type="password" autoComplete="new-password" required minLength={8} placeholder="At least 8 characters" />
          </div>
          <button className="btn btn-primary btn-block" type="submit" disabled={pending}>
            {pending ? "Creating…" : "Create organization"}
          </button>
        </form>

        <p className="foot">Already have an account? <Link href="/login">Sign in</Link></p>
      </div>
    </div>
  );
}
