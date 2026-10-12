import { env } from "cloudflare:workers";
import {
  requireUser,
  readBody,
  HttpError,
  fail,
  reply,
} from "../../../lib/auth";
export const dynamic = "force-dynamic";
const tables = [
  "plans",
  "revisions",
  "tasks",
  "logs",
  "completions",
  "reviews",
];
function database() {
  if (!env.DB) throw new Error("DB unavailable");
  return env.DB;
}
const scoped: Record<string, string> = {
  plans: "SELECT p.* FROM plans p WHERE p.owner_id=?",
  revisions:
    "SELECT r.* FROM revisions r JOIN plans p ON p.id=r.plan_id WHERE p.owner_id=?",
  tasks:
    "SELECT t.* FROM tasks t JOIN plans p ON p.id=t.plan_id WHERE p.owner_id=?",
  logs: "SELECT l.* FROM logs l JOIN tasks t ON t.id=l.task_id JOIN plans p ON p.id=t.plan_id WHERE p.owner_id=?",
  completions:
    "SELECT c.* FROM completions c JOIN tasks t ON t.id=c.task_id JOIN plans p ON p.id=t.plan_id WHERE p.owner_id=?",
  reviews:
    "SELECT r.* FROM reviews r JOIN plans p ON p.id=r.plan_id WHERE p.owner_id=?",
};
async function owned(
  db: D1Database,
  table: string,
  id: string,
  owner: string,
  required = true,
) {
  const alias = (
    {
      plans: "p",
      tasks: "t",
      logs: "l",
      reviews: "r",
      revisions: "r",
      completions: "c",
    } as Record<string, string>
  )[table];
  if (!alias) throw new HttpError(400, "자료 종류를 확인하세요.");
  const row = await db
    .prepare(
      scoped[table] +
        ` AND ${alias}.${table === "completions" ? "task_id" : "id"}=?`,
    )
    .bind(owner, id)
    .first();
  if (row) return row;
  const exists = await db
    .prepare(
      `SELECT 1 FROM ${table} WHERE ${table === "completions" ? "task_id" : "id"}=?`,
    )
    .bind(id)
    .first();
  if (required || exists) throw new HttpError(404, "자료를 찾을 수 없습니다.");
  return null;
}
export async function GET(req: Request) {
  try {
    const u = await requireUser(req),
      db = database(),
      url = new URL(req.url),
      id = url.searchParams.get("id"),
      table = url.searchParams.get("table") || "plans";
    if (id) return reply(await owned(db, table, id, u.id));
    const result = await db.batch(
      tables.map((t) => db.prepare(scoped[t]).bind(u.id)),
    );
    return reply(
      Object.fromEntries(tables.map((t, i) => [t, result[i].results])),
    );
  } catch (e) {
    return fail(e);
  }
}
export async function POST(req: Request) {
  try {
    const b = await readBody(req);
    const u = await requireUser(req);
    const db = database(),
      now = new Date().toISOString();
    const s = (v: unknown, max = 3000) => {
      if (typeof v !== "string" || v.length > max)
        throw Error("입력 내용을 확인하세요.");
      return v.trim();
    };
    const required = (v: unknown) => {
      const x = s(v);
      if (!x) throw Error("필수 항목을 입력하세요.");
      return x;
    };
    const date = (v: unknown) => {
      const x = s(v);
      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(x) ||
        isNaN(Date.parse(x)) ||
        new Date(x).toISOString().slice(0, 10) !== x
      )
        throw Error("날짜를 확인하세요.");
      return x;
    };
    const num = (v: unknown) => {
      const n = Number(v);
      if (!Number.isInteger(n) || n < 0 || n > 100000)
        throw Error("시간은 0~100000분의 정수로 입력하세요.");
      return n;
    };
    const priority = (v: unknown) => {
      if (!["높음", "보통", "낮음"].includes(String(v)))
        throw Error("우선순위를 확인하세요.");
      return String(v);
    };
    const id = required(b.id);
    let queries: D1PreparedStatement[] = [];
    if (b.action === "plan") {
      const title = required(b.title),
        start = date(b.start),
        end = date(b.end),
        p = priority(b.priority),
        success = required(b.success),
        estimate = num(b.estimate),
        improvement = s(b.improvement ?? "");
      if (end < start) throw Error("종료일은 시작일 이후여야 합니다.");
      const old = await owned(db, "plans", id, u.id, false);
      if (old) {
        if (old.version !== Number(b.version))
          return Response.json(
            {
              error:
                "다른 곳에서 수정된 계획입니다. 새로고침 후 다시 수정하세요.",
            },
            { status: 409 },
          );
        queries.push(
          db
            .prepare(
              "INSERT INTO revisions(id,plan_id,snapshot,created) SELECT ?,id,?,? FROM plans WHERE id=? AND version=?",
            )
            .bind(crypto.randomUUID(), JSON.stringify(old), now, id, b.version),
        );
        queries.push(
          db
            .prepare(
              "UPDATE plans SET title=?,start=?,end=?,priority=?,success=?,estimate=?,improvement=?,version=version+1 WHERE id=? AND version=?",
            )
            .bind(
              title,
              start,
              end,
              p,
              success,
              estimate,
              improvement,
              id,
              b.version,
            ),
        );
      } else {
        queries.push(
          db
            .prepare(
              "INSERT INTO plans(id,title,start,end,priority,success,estimate,improvement,created,version,owner_id) VALUES(?,?,?,?,?,?,?,?,?,1,?)",
            )
            .bind(
              id,
              title,
              start,
              end,
              p,
              success,
              estimate,
              improvement,
              now,
              u.id,
            ),
        );
        if (b.starter) {
          for (let i = 0; i < 5; i++) {
            let d = new Date(start + "T00:00:00Z");
            d.setUTCDate(d.getUTCDate() + [0, 2, 4, 7, 10][i]);
            const due = d.toISOString().slice(0, 10);
            queries.push(
              db
                .prepare(
                  "INSERT INTO tasks(id,plan_id,title,due,priority,tag,estimate,created) VALUES(?,?,?,?,?,?,?,?)",
                )
                .bind(
                  crypto.randomUUID(),
                  id,
                  i % 2 === 0 ? "가볍게 걷기" : "헬스장 운동하기",
                  due > end ? end : due,
                  "보통",
                  i % 2 === 0 ? "걷기" : "헬스",
                  i % 2 === 0 ? 20 : 30,
                  now,
                ),
            );
          }
        }
      }
    } else if (b.action === "task") {
      const plan = required(b.plan_id);
      await owned(db, "plans", plan, u.id);
      await owned(db, "tasks", id, u.id, false);
      queries.push(
        db
          .prepare(
            "INSERT INTO tasks(id,plan_id,title,due,priority,tag,estimate,created) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET title=excluded.title,due=excluded.due,priority=excluded.priority,tag=excluded.tag,estimate=excluded.estimate WHERE tasks.deleted=0 AND tasks.plan_id=excluded.plan_id",
          )
          .bind(
            id,
            plan,
            required(b.title),
            date(b.due),
            priority(b.priority),
            required(b.tag),
            num(b.estimate),
            now,
          ),
      );
    } else if (["done", "delete", "log"].includes(b.action)) {
      const task = await owned(
        db,
        "tasks",
        b.action === "log" ? required(b.task_id) : id,
        u.id,
      );
      if (task?.deleted) throw new HttpError(404, "자료를 찾을 수 없습니다.");
      if (b.action === "log") await owned(db, "logs", id, u.id, false);
      if (b.action === "done") {
        if (typeof b.done !== "boolean") throw Error("완료 상태를 확인하세요.");
        queries.push(
          db
            .prepare("UPDATE tasks SET done=? WHERE id=? AND deleted=0")
            .bind(b.done ? 1 : 0, id),
        );
        queries.push(
          b.done
            ? db
                .prepare(
                  "INSERT INTO completions(task_id,created) SELECT id,? FROM tasks WHERE id=? AND deleted=0 ON CONFLICT(task_id) DO NOTHING",
                )
                .bind(now, id)
            : db.prepare("DELETE FROM completions WHERE task_id=?").bind(id),
        );
      }
      if (b.action === "delete") {
        queries.push(
          db.prepare("UPDATE tasks SET deleted=1 WHERE id=?").bind(id),
        );
      }
      if (b.action === "log") {
        const start = required(b.start),
          end = required(b.end);
        if (
          !/(Z|[+-]\d\d:\d\d)$/.test(start) ||
          !/(Z|[+-]\d\d:\d\d)$/.test(end) ||
          !Number.isFinite(Date.parse(start)) ||
          !Number.isFinite(Date.parse(end)) ||
          Date.parse(end) < Date.parse(start)
        )
          throw Error("시작·종료 시각을 확인하세요.");
        queries.push(
          db
            .prepare(
              "INSERT INTO logs(id,task_id,start,end,minutes,note,blocker,created) SELECT ?,id,?,?,?,?,?,? FROM tasks WHERE id=? AND deleted=0 ON CONFLICT(id) DO NOTHING",
            )
            .bind(
              id,
              new Date(start).toISOString(),
              new Date(end).toISOString(),
              num(b.minutes),
              s(b.note ?? ""),
              s(b.blocker ?? ""),
              now,
              b.task_id,
            ),
        );
      }
    } else if (b.action === "review") {
      await owned(db, "plans", required(b.plan_id), u.id);
      await owned(db, "plans", required(b.next_id), u.id, false);
      await owned(db, "reviews", id, u.id, false);
      const start = date(b.start),
        end = date(b.end);
      if (start > end) throw Error("기간을 확인하세요.");
      const improvement = required(b.improvement),
        next = required(b.next_id),
        nextStart = date(b.next_start),
        nextEnd = date(b.next_end);
      if (nextStart > nextEnd) throw Error("다음 계획 기간을 확인하세요.");
      queries.push(
        db
          .prepare(
            "INSERT INTO plans(id,title,start,end,priority,success,estimate,improvement,created,version,owner_id) VALUES(?,?,?,?,?,?,?,?,?,1,?) ON CONFLICT(id) DO NOTHING",
          )
          .bind(
            next,
            required(b.next_title),
            nextStart,
            nextEnd,
            "보통",
            improvement,
            0,
            improvement,
            now,
            u.id,
          ),
      );
      queries.push(
        db
          .prepare(
            "INSERT INTO reviews(id,plan_id,start,end,note,improvement,next_plan_id,created) SELECT ?,p.id,?,?,?,?,n.id,? FROM plans p JOIN plans n ON n.id=? WHERE p.id=? AND p.owner_id=? AND n.owner_id=? ON CONFLICT(id) DO NOTHING",
          )
          .bind(
            id,
            start,
            end,
            s(b.note ?? ""),
            improvement,
            now,
            next,
            required(b.plan_id),
            u.id,
            u.id,
          ),
      );
    } else throw Error("지원하지 않는 요청입니다.");
    const result = await db.batch(queries);
    if (
      b.action === "plan" &&
      queries.length === 2 &&
      result[1].meta.changes === 0
    )
      return Response.json(
        { error: "계획이 변경되었습니다. 새로고침해 주세요." },
        { status: 409 },
      );
    return Response.json({ ok: true });
  } catch (e) {
    if (e instanceof HttpError) return fail(e);
    return Response.json(
      {
        error:
          e instanceof Error &&
          !/SQL|D1|constraint|FOREIGN|UNIQUE/i.test(e.message)
            ? e.message
            : "저장하지 못했습니다. 입력과 연결 상태를 확인하고 다시 시도하세요.",
      },
      { status: 400 },
    );
  }
}
