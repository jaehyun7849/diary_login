import { env } from "cloudflare:workers";
import bcrypt from "bcryptjs";
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export const db = () => {
  if (!env.DB) throw new HttpError(503, "저장소에 연결하지 못했습니다.");
  return env.DB;
};
export const reply = (
  data: unknown,
  status = 200,
  extra: Record<string, string> = {},
) =>
  Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store, private", Vary: "Cookie", ...extra },
  });
export const fail = (e: unknown) =>
  e instanceof HttpError
    ? reply({ error: e.message }, e.status)
    : reply(
        { error: "요청을 처리하지 못했습니다. 잠시 후 다시 시도하세요." },
        500,
      );
export async function digest(value: string) {
  return Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
    ),
    (x) => x.toString(16).padStart(2, "0"),
  ).join("");
}
export function cookieName(req: Request) {
  return new URL(req.url).protocol === "https:"
    ? "__Host-move_session"
    : "move_session";
}
export function cookie(req: Request, token: string, age = 86400) {
  return `${cookieName(req)}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${age}${new URL(req.url).protocol === "https:" ? "; Secure" : ""}`;
}
export async function currentUser(req: Request) {
  const token = (req.headers.get("cookie") || "")
    .split(";")
    .map((x) => x.trim())
    .find((x) => x.startsWith(cookieName(req) + "="))
    ?.split("=")[1];
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  return db()
    .prepare(
      "SELECT u.id,u.username,u.auth_version,s.token_hash,s.expires FROM sessions s JOIN users u ON u.id=s.user_id AND u.auth_version=s.version WHERE s.token_hash=? AND s.expires>?",
    )
    .bind(await digest(token), new Date().toISOString())
    .first<{
      id: string;
      username: string;
      auth_version: number;
      token_hash: string;
      expires: string;
    }>();
}
export async function requireUser(req: Request) {
  const u = await currentUser(req);
  if (!u) throw new HttpError(401, "로그인이 필요합니다.");
  return u;
}
export async function readBody(req: Request) {
  const raw = await req.text();
  if (new TextEncoder().encode(raw).length > 16000)
    throw new HttpError(413, "입력 내용이 너무 큽니다.");
  if (req.headers.get("origin") !== new URL(req.url).origin)
    throw new HttpError(403, "요청 출처를 확인할 수 없습니다.");
  if (!req.headers.get("content-type")?.startsWith("application/json"))
    throw new HttpError(415, "JSON 요청이 필요합니다.");
  let b;
  try {
    b = JSON.parse(raw);
  } catch {
    throw new HttpError(400, "입력 형식을 확인하세요.");
  }
  if (!b || typeof b !== "object" || Array.isArray(b))
    throw new HttpError(400, "입력을 확인하세요.");
  return b as Record<string, any>;
}
export function password(value: unknown) {
  if (
    typeof value !== "string" ||
    value.length < 12 ||
    bcrypt.truncates(value) ||
    value.includes("\0")
  )
    throw new HttpError(
      400,
      "비밀번호는 12자 이상, UTF-8 기준 72바이트 이하로 입력하세요.",
    );
  return value;
}
export const dummyHash =
  "$2b$12$fkSN8ZuDtuE5d7MmJKFzD.zfKMt8kyLQREMGu15wP56.PO16NhWCW";
export async function rateLimit(req: Request, scope: string, identity: string) {
  const now = Date.now(),
    bucket = Math.floor(now / 900000),
    expires = new Date((bucket + 1) * 900000).toISOString();
  const ip = req.headers.get("cf-connecting-ip") || "local";
  const specs = [
    [`ip:${scope}:${ip}`, 60],
    [`account:${scope}:${identity}`, 15],
  ] as const;
  const stmts = await Promise.all(
    specs.map(async ([key]) =>
      db()
        .prepare(
          "INSERT INTO auth_attempts(key,count,expires) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count",
        )
        .bind(await digest(key + ":" + bucket), expires),
    ),
  );
  const results = await db().batch(stmts);
  if (
    results.some(
      (r, i) =>
        Number((r.results[0] as { count: number })?.count) > specs[i][1],
    )
  )
    throw new HttpError(429, "시도가 많습니다. 15분 후 다시 시도하세요.");
  await db()
    .prepare("DELETE FROM auth_attempts WHERE expires<?")
    .bind(new Date(now - 900000).toISOString())
    .run();
}
export async function issueSession(
  req: Request,
  u: { id: string; auth_version: number },
) {
  const token = Array.from(crypto.getRandomValues(new Uint8Array(32)), (x) =>
    x.toString(16).padStart(2, "0"),
  ).join("");
  const now = new Date(),
    expires = new Date(now.getTime() + 86400000).toISOString();
  await db()
    .prepare(
      "INSERT INTO sessions(token_hash,user_id,version,expires,created) SELECT ?,id,auth_version,?,? FROM users WHERE id=? AND auth_version=?",
    )
    .bind(await digest(token), expires, now.toISOString(), u.id, u.auth_version)
    .run();
  return reply({ ok: true, expires }, 200, {
    "Set-Cookie": cookie(req, token),
  });
}
