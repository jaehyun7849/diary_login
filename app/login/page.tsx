import AuthForm from "./AuthForm";
import { pageUser } from "../../lib/page-user";
import { redirect } from "next/navigation";
export const dynamic = "force-dynamic";
export default async function Login() {
  if (await pageUser()) redirect("/");
  return <AuthForm />;
}
