import "server-only";
// Platform-staff check for internal dashboards (revenue, cross-org metrics).
// The portal's RBAC (OWNER/ADMIN/MEMBER/CLIENT) is entirely org-scoped by
// design — there is no cross-tenant "platform admin" role. Rather than bolt
// one on for a single internal page, staff access is an explicit email
// allowlist read from PLATFORM_ADMIN_EMAILS (comma-separated). Empty/unset =
// nobody has access, including in production. This is intentionally narrow:
// revisit with a real staff-role model if internal tooling grows beyond one page.
export function isPlatformAdmin(email: string): boolean {
  const raw = process.env.PLATFORM_ADMIN_EMAILS ?? "";
  const allowed = raw.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
  return allowed.includes(email.toLowerCase());
}
