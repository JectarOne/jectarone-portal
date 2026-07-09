import Link from "next/link";

export function TrialBanner({
  status, trialEndsAt, canManage,
}: {
  status: string;
  trialEndsAt: Date | null;
  canManage: boolean;
}) {
  if (status === "trialing" && trialEndsAt) {
    const daysLeft = Math.max(0, Math.ceil((trialEndsAt.getTime() - Date.now()) / 86_400_000));
    return (
      <div className="trial-banner" role="status">
        <span>{daysLeft} day{daysLeft === 1 ? "" : "s"} left in your free trial.</span>
        {canManage && <Link href="/dashboard/settings/billing">Upgrade now</Link>}
      </div>
    );
  }
  if (status === "expired") {
    return (
      <div className="trial-banner trial-banner-expired" role="alert">
        <span>Your trial has ended — you&apos;re on limited Starter access.</span>
        {canManage && <Link href="/dashboard/settings/billing">Choose a plan</Link>}
      </div>
    );
  }
  if (status === "past_due") {
    return (
      <div className="trial-banner trial-banner-expired" role="alert">
        <span>Your last payment failed.</span>
        {canManage && <Link href="/dashboard/settings/billing">Update payment method</Link>}
      </div>
    );
  }
  return null;
}
