import { getSession } from "@/lib/auth";
import { ProfileForms } from "./ProfileForms";

export default async function ProfilePage() {
  const session = await getSession();
  if (!session) return null;
  return <ProfileForms name={session.user.name} email={session.user.email} />;
}
