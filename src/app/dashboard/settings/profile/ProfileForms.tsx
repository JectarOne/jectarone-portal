"use client";

import { useActionState } from "react";
import { updateProfileAction, changePasswordAction, type FormState } from "@/actions/settings";

const init: FormState = {};

export function ProfileForms({ name, email }: { name: string; email: string }) {
  const [ps, profileAction, pPending] = useActionState(updateProfileAction, init);
  const [cs, pwAction, cPending] = useActionState(changePasswordAction, init);

  return (
    <div className="grid grid-2" style={{ marginTop: "1rem" }}>
      <div className="card">
        <h3 className="chart-title">Profile</h3>
        {ps.ok && <div className="alert alert-ok">{ps.ok}</div>}
        {ps.error && <div className="alert alert-error">{ps.error}</div>}
        <form action={profileAction}>
          <div className="field"><label htmlFor="name">Name</label><input id="name" name="name" defaultValue={name} required /></div>
          <div className="field"><label htmlFor="email">Email</label><input id="email" type="email" value={email} disabled /></div>
          <button className="btn btn-primary" type="submit" disabled={pPending}>{pPending ? "Saving…" : "Save profile"}</button>
        </form>
      </div>
      <div className="card">
        <h3 className="chart-title">Change password</h3>
        {cs.ok && <div className="alert alert-ok">{cs.ok}</div>}
        {cs.error && <div className="alert alert-error">{cs.error}</div>}
        <form action={pwAction}>
          <div className="field"><label htmlFor="current">Current password</label><input id="current" name="current" type="password" autoComplete="current-password" required /></div>
          <div className="field"><label htmlFor="next">New password</label><input id="next" name="next" type="password" autoComplete="new-password" minLength={8} required /></div>
          <button className="btn btn-primary" type="submit" disabled={cPending}>{cPending ? "Updating…" : "Change password"}</button>
        </form>
      </div>
    </div>
  );
}
