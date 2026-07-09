"use client";

import { useActionState } from "react";
import { confirmMockCheckoutAction, type BillingState } from "@/actions/billing";
import type { Plan } from "@/lib/plans";

export function MockCheckoutForm({ plan, cycle, label }: { plan: Plan; cycle: "monthly" | "annual"; label: string }) {
  const [state, formAction, pending] = useActionState(confirmMockCheckoutAction, {} as BillingState);
  return (
    <form action={formAction}>
      <input type="hidden" name="plan" value={plan} />
      <input type="hidden" name="cycle" value={cycle} />
      <button className="btn btn-primary btn-block" type="submit" disabled={pending}>{pending ? "Processing…" : label}</button>
      {state.error && <p className="hint" style={{ marginTop: "0.4rem" }}>{state.error}</p>}
    </form>
  );
}
