"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { verifyEmailAction, resendVerificationAction } from "@/actions/account";

export function VerifyEmailClient({ token }: { token: string | null }) {
  const [status, setStatus] = useState<"idle" | "checking" | "ok" | "fail">(token ? "checking" : "idle");
  const [msg, setMsg] = useState<string | null>(null);
  const ran = useRef(false);

  useEffect(() => {
    if (!token || ran.current) return;
    ran.current = true;
    verifyEmailAction(token).then((r) => setStatus(r.ok ? "ok" : "fail"));
  }, [token]);

  async function resend() {
    setMsg(null);
    const r = await resendVerificationAction();
    setMsg(r.error ?? r.ok ?? null);
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <span className="brand"><span className="mark">J</span><span>JectarOne<small>Client Portal</small></span></span>
        <h1>Verify your email</h1>

        {status === "checking" && <p className="sub">Confirming your email…</p>}

        {status === "ok" && (
          <>
            <div className="alert alert-ok">Your email is verified. You&rsquo;re all set.</div>
            <Link className="btn btn-primary btn-block" href="/dashboard">Go to dashboard</Link>
          </>
        )}

        {status === "fail" && (
          <>
            <div className="alert alert-error">This verification link is invalid or has expired.</div>
            <p className="sub">Request a fresh link:</p>
            <button className="btn btn-primary btn-block" onClick={resend}>Resend verification email</button>
          </>
        )}

        {status === "idle" && (
          <>
            <p className="sub">We sent a verification link to your email. Open it to activate your account.</p>
            <button className="btn btn-primary btn-block" onClick={resend}>Resend verification email</button>
          </>
        )}

        {msg && <div className="alert alert-ok" style={{ marginTop: "1rem" }}>{msg}</div>}
        <p className="foot"><Link href="/dashboard">Back to dashboard</Link></p>
      </div>
    </div>
  );
}
