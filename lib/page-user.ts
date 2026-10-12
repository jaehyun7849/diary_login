import { headers } from "next/headers";
import { currentUser } from "./auth";
export async function pageUser() {
  const h = await headers();
  const host = h.get("host") || "localhost";
  const protocol = /^(localhost|127\.0\.0\.1)(:|$)/.test(host)
    ? "http"
    : "https";
  return currentUser(
    new Request(protocol + "://" + host, {
      headers: { cookie: h.get("cookie") || "" },
    }),
  );
}
