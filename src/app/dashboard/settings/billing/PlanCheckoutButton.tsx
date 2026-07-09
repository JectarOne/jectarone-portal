"use client";

import { useActionState } from "react";
import { startCheckoutAction, type BillingState } from "@/actions/billing";
import type { Plan } from "@/lib/plans";

export function PlanCheckoutButton({
  plan, cycle, label, variant = "secondary",
}: {
  plan: Plan;
  cycle: "monthly" | "annual";
  label: string;
  variant?: "primary" | "secondary";
}) {
  const [state, formAction, pending] = useActionState(startCheckoutAction, {} as BillingState);
  return (
    <form action={formAction}>
      <input type="hidden" name="plan" value={plan} />
      <input type="hidden" name="cycle" value={cycle} />
      <button className={`btn btn-${variant} btn-block`} type="submit" disabled={pending}>
        {pending ? "Redirecting…" : label}
      </button>
      {state.error && <p className="hint" style={{ marginTop: "0.4rem" }}>{state.error}</p>}
    </form>
  );
}
