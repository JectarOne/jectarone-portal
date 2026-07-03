import { prisma } from "@/lib/db";
import { apiSession, requireRoleOr403, json } from "@/lib/api";
import { statusChangeSchema } from "@/lib/validation";
import { STATUS_TRANSITIONS } from "@/lib/findings";
import { logActivity } from "@/lib/activity";

/** POST /api/v1/findings/:fid/status  { "status": "Resolved" } — org-scoped, MEMBER+. */
export async function POST(req: Request, { params }: { params: Promise<{ fid: string }> }) {
  const res = await apiSession();
  if ("response" in res) return res.response;
  const { session } = res;
  const forbidden = requireRoleOr403(session, "MEMBER");
  if (forbidden) return forbidden;
  const { fid } = await params;

  const existing = await prisma.finding.findUnique({ where: { id: fid } });
  if (!existing || existing.organizationId !== session.orgId) return json({ error: "Not found." }, 404);

  const body = await req.json().catch(() => ({}));
  const parsed = statusChangeSchema.safeParse(body);
  if (!parsed.success) return json({ error: parsed.error.issues[0]?.message ?? "Invalid status." }, 400);
  const next = parsed.data.status;

  const allowed = STATUS_TRANSITIONS[existing.status] ?? Object.keys(STATUS_TRANSITIONS);
  if (next !== existing.status && !allowed.includes(next)) {
    return json({ error: `Transition ${existing.status} → ${next} not allowed.` }, 400);
  }

  const now = new Date();
  const data: Record<string, unknown> = { status: next };
  if (next === "Resolved") data.resolvedAt = now;
  if (next === "Open") { data.resolvedAt = null; data.validatedAt = null; }

  const updated = await prisma.finding.update({ where: { id: fid }, data, select: { id: true, status: true } });
  if (next !== existing.status) {
    await logActivity({
      organizationId: session.orgId, userId: session.userId, action: "finding.status_changed",
      detail: `${existing.status} → ${next}`, assessmentId: existing.assessmentId, findingId: fid,
    });
  }
  return json({ finding: updated });
}
