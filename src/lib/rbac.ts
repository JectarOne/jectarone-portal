// Role hierarchy for the portal. Higher number = more privilege.
export const ROLES = ["MEMBER", "ADMIN", "OWNER"] as const;
export type Role = (typeof ROLES)[number];

const RANK: Record<Role, number> = { MEMBER: 1, ADMIN: 2, OWNER: 3 };

export function isRole(value: string): value is Role {
  return (ROLES as readonly string[]).includes(value);
}

/** True if `role` meets or exceeds `min` in the hierarchy. */
export function hasRole(role: string, min: Role): boolean {
  if (!isRole(role)) return false;
  return RANK[role] >= RANK[min];
}

export function roleLabel(role: string): string {
  return isRole(role) ? role.charAt(0) + role.slice(1).toLowerCase() : role;
}
