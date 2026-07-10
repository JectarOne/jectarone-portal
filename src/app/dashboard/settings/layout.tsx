import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { SettingsNav } from "@/components/settings-nav";
import { billingEnabled } from "@/lib/stripe";

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");
  return (
    <>
      <div className="topbar"><div><h1>Settings</h1><p>{session.organization.name}</p></div></div>
      <SettingsNav showBilling={billingEnabled()} />
      {children}
    </>
  );
}
