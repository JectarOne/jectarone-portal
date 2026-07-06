import "server-only";
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import crypto from "node:crypto";
import { prisma } from "./db";
import { getSession, type Session } from "./auth";
import { hasRole, type Role } from "./rbac";

/** Resolve an org API token from `Authorization: Bearer jo_…` into a Session. */
async function sessionFromApiToken(): Promise<Session | null> {
  const auth = (await headers()).get("authorization") ?? "";
  const m = auth.match(/^Bearer\s+(jo_[A-Za-z0-9_-]+)$/);
  if (!m) return null;
  const tokenHash = crypto.createHash("sha256").update(m[1]).digest("hex");
  const t = await prisma.apiToken.findUnique({ where: { tokenHash } });
  if (!t || t.revokedAt) return null;
  const membership = await prisma.membership.findUnique({
    where: { userId_organizationId: { userId: t.userId, organizationId: t.organizationId } },
    include: { user: true, organization: true },
  });
  if (!membership) return null;
  await prisma.apiToken.update({ where: { id: t.id }, data: { lastUsedAt: new Date() } });
  return {
    userId: membership.userId, orgId: membership.organizationId, role: membership.role, sessionId: null,
    user: { id: membership.user.id, name: membership.user.name, email: membership.user.email, emailVerifiedAt: membership.user.emailVerifiedAt },
    organization: { id: membership.organization.id, name: membership.organization.name, slug: membership.organization.slug },
  };
}

/** Resolve the caller (session cookie OR API token), or return a 401 response. */
export async function apiSession(): Promise<{ session: Session } | { response: NextResponse }> {
  const session = (await getSession()) ?? (await sessionFromApiToken());
  if (!session) return { response: NextResponse.json({ error: "Not authenticated." }, { status: 401 }) };
  return { session };
}

export function requireRoleOr403(session: Session, min: Role): NextResponse | null {
  return hasRole(session.role, min) ? null : NextResponse.json({ error: "Forbidden." }, { status: 403 });
}

export const json = (data: unknown, status = 200) => NextResponse.json(data, { status });
