import { NextResponse } from "next/server";
import { getSession, type Session } from "./auth";
import { hasRole, type Role } from "./rbac";

/** Resolve the session for an API route, or return a 401 response. */
export async function apiSession(): Promise<{ session: Session } | { response: NextResponse }> {
  const session = await getSession();
  if (!session) return { response: NextResponse.json({ error: "Not authenticated." }, { status: 401 }) };
  return { session };
}

export function requireRoleOr403(session: Session, min: Role): NextResponse | null {
  return hasRole(session.role, min) ? null : NextResponse.json({ error: "Forbidden." }, { status: 403 });
}

export const json = (data: unknown, status = 200) => NextResponse.json(data, { status });
