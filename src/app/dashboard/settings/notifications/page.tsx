import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { EmailPrefsForm } from "./EmailPrefsForm";

export default async function NotificationsPage() {
  const session = await getSession();
  if (!session) return null;
  const user = await prisma.user.findUnique({ where: { id: session.userId }, select: { emailPrefs: true } });
  let prefs: Record<string, boolean> = {};
  try { prefs = JSON.parse(user?.emailPrefs ?? "{}"); } catch { prefs = {}; }
  return <EmailPrefsForm prefs={prefs} />;
}
