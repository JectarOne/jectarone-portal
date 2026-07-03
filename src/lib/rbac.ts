// Role hierarchy for the portal. Higher number = more privilege.
// CLIENT (Sprint 5) = read-only. MEMBER = "Security Analyst" (edit/assign/close).
// ADMIN/OWNER = full. Mutations are gated at MEMBER+, so CLIENT is read-only everywhere.
export const ROLES = ["CLIENT", "MEMBER", "ADMIN", "OWNER"] as const;
export type Role = (typeof ROLES)[number];

const RANK: Record<Role, number> = { CLIENT: 0, MEMBER: 1, ADMIN: 2, OWNER: 3 };

export function isRole(value: string): value is Role {
  return (ROLES as readonly string[]).includes(value);
}

/** True if `role` meets or exceeds `min` in the hierarchy. */
export function hasRole(role: string, min: Role): boolean {
  if (!isRole(role)) return false;
  return RANK[role] >= RANK[min];
}

const ROLE_LABELS: Record<string, string> = {
  OWNER: "Owner",
  ADMIN: "Admin",
  MEMBER: "Security Analyst",
  CLIENT: "Client (read-only)",
};
export function roleLabel(role: string): string {
  return ROLE_LABELS[role] ?? (isRole(role) ? role : role);
}
