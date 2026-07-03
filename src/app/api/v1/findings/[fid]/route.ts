import { prisma } from "@/lib/db";
import { apiSession, json } from "@/lib/api";

/** GET /api/v1/findings/:fid — full finding incl. timeline + comments (org-scoped). */
export async function GET(_req: Request, { params }: { params: Promise<{ fid: string }> }) {
  const res = await apiSession();
  if ("response" in res) return res.response;
  const { session } = res;
  const { fid } = await params;

  const finding = await prisma.finding.findUnique({
    where: { id: fid },
    include: {
      assignee: { select: { id: true, name: true } },
      acceptedRiskBy: { select: { id: true, name: true } },
      evidence: { where: { deletedAt: null }, select: { id: true, filename: true, mimeType: true, sizeBytes: true, createdAt: true } },
      comments: { where: { deletedAt: null }, orderBy: { createdAt: "asc" }, include: { author: { select: { name: true } } } },
      activities: { orderBy: { createdAt: "asc" }, include: { user: { select: { name: true } } } },
    },
  });
  if (!finding || finding.organizationId !== session.orgId) {
    return json({ error: "Not found." }, 404);
  }
  return json({ finding });
}
