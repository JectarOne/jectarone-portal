import Link from "next/link";
import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { updateAssetAction } from "@/actions/assets";
import { AssetForm } from "../../AssetForm";

export default async function EditAssetPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return null;
  const { id } = await params;

  const a = await prisma.asset.findUnique({ where: { id } });
  if (!a || a.organizationId !== session.orgId) notFound();

  const bound = updateAssetAction.bind(null, a.id);

  return (
    <>
      <div className="topbar">
        <div>
          <p className="muted" style={{ fontSize: "0.85rem" }}><Link href="/dashboard/assets">Assets</Link> / Edit</p>
          <h1>Edit asset</h1>
        </div>
      </div>
      <AssetForm
        action={bound}
        submitLabel="Save changes"
        cancelHref="/dashboard/assets"
        values={{ name: a.name, type: a.type, identifier: a.identifier, notes: a.notes }}
      />
    </>
  );
}
