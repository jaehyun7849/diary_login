import { pageUser } from "../../lib/page-user";
import { redirect } from "next/navigation";
import Account from "./Account";
export const dynamic = "force-dynamic";
export default async function Page() {
  const u = await pageUser();
  if (!u) redirect("/login");
  return <Account username={u.username} />;
}
