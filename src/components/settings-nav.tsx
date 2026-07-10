"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  ["/dashboard/settings/profile", "Profile"],
  ["/dashboard/settings/organization", "Organization"],
  ["/dashboard/settings/billing", "Billing"],
  ["/dashboard/settings/sessions", "Sessions"],
  ["/dashboard/settings/api-tokens", "API tokens"],
  ["/dashboard/settings/notifications", "Email"],
  ["/dashboard/settings/audit", "Audit log"],
] as const;

export function SettingsNav({ showBilling = true }: { showBilling?: boolean }) {
  const pathname = usePathname();
  const tabs = showBilling ? TABS : TABS.filter(([href]) => href !== "/dashboard/settings/billing");
  return (
    <nav className="subnav" aria-label="Settings sections">
      {tabs.map(([href, label]) => (
        <Link key={href} href={href} className={pathname === href ? "active" : ""} aria-current={pathname === href ? "page" : undefined}>
          {label}
        </Link>
      ))}
    </nav>
  );
}
