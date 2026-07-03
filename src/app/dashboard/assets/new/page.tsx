import Link from "next/link";
import { createAssetAction } from "@/actions/assets";
import { AssetForm } from "../AssetForm";

export default function NewAssetPage() {
  return (
    <>
      <div className="topbar">
        <div>
          <p className="muted" style={{ fontSize: "0.85rem" }}><Link href="/dashboard/assets">Assets</Link> / New</p>
          <h1>New asset</h1>
        </div>
      </div>
      <AssetForm action={createAssetAction} submitLabel="Create asset" cancelHref="/dashboard/assets" />
    </>
  );
}
