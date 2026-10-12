import bcrypt from "bcryptjs";
import {
  db,
  reply,
  fail,
  HttpError,
  readBody,
  password,
  dummyHash,
  currentUser,
  requireUser,
  rateLimit,
  issueSession,
  cookie,
} from "../../../lib/auth";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  try {
    const u = await currentUser(req);
    return reply({
      user: u ? { id: u.id, username: u.username, expires: u.expires } : null,
    });
  } catch (e) {
    return fail(e);
  }
}
export async function POST(req: Request) {
  try {
    const b = await readBody(req);
    if (["register", "login"].includes(b.action)) {
      const username =
        typeof b.username === "string" ? b.username.trim().toLowerCase() : "";
      if (!/^[a-z0-9_]{4,32}$/.test(username))
        throw new HttpError(
          400,
          "아이디는 영문 소문자·숫자·밑줄 4~32자로 입력하세요.",
        );
      await rateLimit(req, b.action, username);
      const pw = password(b.password);
      if (b.action === "register") {
        const hash = await bcrypt.hash(pw, 12),
          id = crypto.randomUUID();
        const r = await db()
          .prepare(
            "INSERT INTO users(id,username,password_hash,auth_version,created) VALUES(?,?,?,1,?) ON CONFLICT(username) DO NOTHING",
          )
          .bind(id, username, hash, new Date().toISOString())
          .run();
        if (!r.meta.changes)
          throw new HttpError(
            409,
            "이 아이디로 가입할 수 없습니다. 다른 아이디를 사용하세요.",
          );
        return issueSession(req, { id, auth_version: 1 });
      }
      const u = await db()
        .prepare(
          "SELECT id,password_hash,auth_version FROM users WHERE username=?",
        )
        .bind(username)
        .first<{ id: string; password_hash: string; auth_version: number }>();
      const valid = await bcrypt.compare(pw, u?.password_hash || dummyHash);
      if (!u || !valid)
        throw new HttpError(401, "아이디 또는 비밀번호가 올바르지 않습니다.");
      return issueSession(req, u);
    }
    const u = await requireUser(req);
    if (b.action === "logout") {
      await db()
        .prepare("DELETE FROM sessions WHERE token_hash=?")
        .bind(u.token_hash)
        .run();
      return reply({ ok: true }, 200, { "Set-Cookie": cookie(req, "", 0) });
    }
    if (["password", "delete"].includes(b.action)) {
      await rateLimit(req, "sensitive", u.id);
      const stored = await db()
        .prepare("SELECT password_hash FROM users WHERE id=?")
        .bind(u.id)
        .first<{ password_hash: string }>();
      if (
        !stored ||
        !(await bcrypt.compare(password(b.password), stored.password_hash))
      )
        throw new HttpError(401, "현재 비밀번호를 확인하세요.");
      if (b.action === "password") {
        const hash = await bcrypt.hash(password(b.newPassword), 12);
        const r = await db().batch([
          db()
            .prepare(
              "UPDATE users SET password_hash=?,auth_version=auth_version+1 WHERE id=? AND auth_version=?",
            )
            .bind(hash, u.id, u.auth_version),
          db().prepare("DELETE FROM sessions WHERE user_id=?").bind(u.id),
        ]);
        if (!r[0].meta.changes)
          throw new HttpError(
            409,
            "계정 상태가 바뀌었습니다. 다시 로그인하세요.",
          );
        return reply({ ok: true }, 200, { "Set-Cookie": cookie(req, "", 0) });
      }
      if (b.confirm !== "계정 삭제")
        throw new HttpError(400, "계정 삭제 문구를 입력하세요.");
      const ownTasks =
        "SELECT t.id FROM tasks t JOIN plans p ON p.id=t.plan_id WHERE p.owner_id=?";
      const queries = [
        db()
          .prepare(`DELETE FROM completions WHERE task_id IN (${ownTasks})`)
          .bind(u.id),
        db()
          .prepare(`DELETE FROM logs WHERE task_id IN (${ownTasks})`)
          .bind(u.id),
        db()
          .prepare(
            "DELETE FROM reviews WHERE plan_id IN (SELECT id FROM plans WHERE owner_id=?)",
          )
          .bind(u.id),
        db()
          .prepare(
            "DELETE FROM revisions WHERE plan_id IN (SELECT id FROM plans WHERE owner_id=?)",
          )
          .bind(u.id),
        db()
          .prepare(
            "DELETE FROM tasks WHERE plan_id IN (SELECT id FROM plans WHERE owner_id=?)",
          )
          .bind(u.id),
        db().prepare("DELETE FROM plans WHERE owner_id=?").bind(u.id),
        db().prepare("DELETE FROM users WHERE id=?").bind(u.id),
      ];
      await db().batch(queries);
      return reply({ ok: true }, 200, { "Set-Cookie": cookie(req, "", 0) });
    }
    throw new HttpError(400, "지원하지 않는 요청입니다.");
  } catch (e) {
    return fail(e);
  }
}
