import { prisma } from "@/lib/db";
import { apiSession, requireRoleOr403, json } from "@/lib/api";
import { commentSchema } from "@/lib/validation";
import { logActivity } from "@/lib/activity";

async function findingInOrg(fid: string, orgId: string) {
  const f = await prisma.finding.findUnique({ where: { id: fid } });
  return f && f.organizationId === orgId ? f : null;
}

/** GET /api/v1/findings/:fid/comments — list (org-scoped). */
export async function GET(_req: Request, { params }: { params: Promise<{ fid: string }> }) {
  const res = await apiSession();
  if ("response" in res) return res.response;
  const { session } = res;
  const { fid } = await params;
  if (!(await findingInOrg(fid, session.orgId))) return json({ error: "Not found." }, 404);

  const comments = await prisma.findingComment.findMany({
    where: { findingId: fid, deletedAt: null },
    orderBy: { createdAt: "asc" },
    include: { author: { select: { name: true } } },
  });
  return json({ comments });
}

/** POST /api/v1/findings/:fid/comments  { "body": "…" } — MEMBER+. */
export async function POST(req: Request, { params }: { params: Promise<{ fid: string }> }) {
  const res = await apiSession();
  if ("response" in res) return res.response;
  const { session } = res;
  const forbidden = requireRoleOr403(session, "MEMBER");
  if (forbidden) return forbidden;
  const { fid } = await params;

  const finding = await findingInOrg(fid, session.orgId);
  if (!finding) return json({ error: "Not found." }, 404);

  const body = await req.json().catch(() => ({}));
  const parsed = commentSchema.safeParse(body);
  if (!parsed.success) return json({ error: parsed.error.issues[0]?.message ?? "Invalid comment." }, 400);

  const comment = await prisma.findingComment.create({
    data: { organizationId: session.orgId, findingId: fid, authorId: session.userId, body: parsed.data.body },
    select: { id: true, body: true, createdAt: true },
  });
  await logActivity({
    organizationId: session.orgId, userId: session.userId, action: "comment.added",
    assessmentId: finding.assessmentId, findingId: fid,
  });
  return json({ comment }, 201);
}
