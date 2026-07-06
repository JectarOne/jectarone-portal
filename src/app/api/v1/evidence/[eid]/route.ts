import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { apiSession, json } from "@/lib/api";
import { storageConfigured, presignDownload } from "@/lib/storage";
import { logActivity } from "@/lib/activity";

/** GET /api/v1/evidence/:eid — redirect to a short-lived presigned download URL (org-scoped). */
export async function GET(_req: Request, { params }: { params: Promise<{ eid: string }> }) {
  const res = await apiSession();
  if ("response" in res) return res.response;
  const { session } = res;
  const { eid } = await params;

  const ev = await prisma.evidence.findUnique({ where: { id: eid }, include: { finding: { select: { assessmentId: true } } } });
  if (!ev || ev.organizationId !== session.orgId || ev.deletedAt) return json({ error: "Not found." }, 404);
  if (!ev.storageKey || !storageConfigured()) return json({ error: "No stored file for this evidence." }, 404);

  // Record the download so the UI can show a per-file download count.
  await logActivity({
    organizationId: session.orgId, userId: session.userId, action: "evidence.downloaded",
    detail: ev.filename, assessmentId: ev.finding.assessmentId, findingId: ev.findingId,
  });

  const url = await presignDownload(ev.storageKey, ev.filename);
  return NextResponse.redirect(url);
}
