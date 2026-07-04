"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** Sidebar nav link that highlights itself for the current route and sets
 * aria-current for assistive tech. "/dashboard" matches exactly (so it is not
 * active on every sub-route); other links match the route prefix. */
export function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const active = href === "/dashboard" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
  return (
    <Link className={`nav-link${active ? " active" : ""}`} href={href} aria-current={active ? "page" : undefined}>
      {children}
    </Link>
  );
}

/** Initials avatar from a display name. */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function Avatar({ name, size = 34 }: { name: string; size?: number }) {
  return (
    <span className="avatar" aria-hidden="true" style={{ width: size, height: size, fontSize: size * 0.4 }}>
      {initials(name)}
    </span>
  );
}
