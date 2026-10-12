import { pageUser } from "../../lib/page-user";
import { redirect } from "next/navigation";
import Experiment from "./Experiment";
export const dynamic = "force-dynamic";
export default async function Page() {
  if (!(await pageUser())) redirect("/login");
  return <Experiment />;
}
