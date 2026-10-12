import { pageUser } from "../lib/page-user";
import { redirect } from "next/navigation";
import Diary from "./Diary";
export const dynamic = "force-dynamic";
export default async function Home() {
  const user = await pageUser();
  if (!user) redirect("/login");
  return <Diary username={user.username} />;
}
