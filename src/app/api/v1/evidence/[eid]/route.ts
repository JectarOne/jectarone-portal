import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { apiSession, json } from "@/lib/api";
import { storageConfigured, presignDownload } from "@/lib/storage";

/** GET /api/v1/evidence/:eid — redirect to a short-lived presigned download URL (org-scoped). */
export async function GET(_req: Request, { params }: { params: Promise<{ eid: string }> }) {
  const res = await apiSession();
  if ("response" in res) return res.response;
  const { session } = res;
  const { eid } = await params;

  const ev = await prisma.evidence.findUnique({ where: { id: eid } });
  if (!ev || ev.organizationId !== session.orgId || ev.deletedAt) return json({ error: "Not found." }, 404);
  if (!ev.storageKey || !storageConfigured()) return json({ error: "No stored file for this evidence." }, 404);

  const url = await presignDownload(ev.storageKey, ev.filename);
  return NextResponse.redirect(url);
}
