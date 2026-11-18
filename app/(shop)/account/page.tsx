import { pageUser } from "@/lib/auth";
import ProfileForm from "./ProfileForm";
import PasswordForm from "./PasswordForm";

export const metadata = { title: "My account" };

export default async function AccountPage() {
  const u = await pageUser("/account");
  return <><ProfileForm name={u.name} phone={u.phone ?? ""} email={u.email ?? ""} measurements={u.measurements} dob={u.dob ?? ""} /><PasswordForm hasPassword={!!u.passwordHash} /></>;
}
