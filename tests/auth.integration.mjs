import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { seoulDate } from "../lib/metrics.mjs";
const base = "http://127.0.0.1:5173",
  uid = () => crypto.randomUUID();
const sqlFile = fs
  .readdirSync(".wrangler/state/v3/d1/miniflare-D1DatabaseObject")
  .find((f) => f.endsWith(".sqlite"));
const sqlitePath = path.resolve(
  ".wrangler/state/v3/d1/miniflare-D1DatabaseObject",
  sqlFile,
);
const sql = {
  prepare(query) {
    return Object.fromEntries(
      ["get", "all", "run"].map((method) => [
        method,
        (...args) => {
          const c = new DatabaseSync(sqlitePath);
          try {
            return c.prepare(query)[method](...args);
          } finally {
            c.close();
          }
        },
      ]),
    );
  },
  close() {},
};
const records = [],
  suffix = Date.now().toString(36),
  pw = uid() + uid().slice(0, 10),
  newPw = uid() + uid().slice(0, 10);
async function call(label, url, body, cookie = "", status = 200, extra = {}) {
  const method = body ? "POST" : "GET",
    headers = {
      ...(body ? { "Content-Type": "application/json", Origin: base } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
      ...extra,
    };
  const r = await fetch(base + url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    redirect: "manual",
  });
  const raw = await r.text();
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    data = raw.slice(0, 150);
  }
  assert.equal(r.status, status, label + ": " + JSON.stringify(data));
  assert(!raw.includes(pw) && !raw.includes(newPw), "Raw password leaked");
  const sanitize = (obj) =>
    JSON.parse(
      JSON.stringify(obj, (key, value) =>
        /password|cookie|token/i.test(key) ? "[가림]" : value,
      ),
    );
  records.push({
    label,
    request: {
      method,
      url,
      headers: {
        ...(body ? { Origin: headers.Origin } : {}),
        ...(cookie ? { Cookie: "[동일 세션 값 가림]" } : {}),
        ...(extra["X-User-Id"] ? { "X-User-Id": extra["X-User-Id"] } : {}),
      },
      body: sanitize(body || null),
    },
    response: { status: r.status, body: sanitize(data) },
  });
  return {
    data,
    cookie: r.headers.get("set-cookie")?.split(";")[0] || "",
    headers: r.headers,
  };
}
const a = (
  await call("A 가입", "/api/auth", {
    action: "register",
    username: "testa_" + suffix,
    password: pw,
  })
).cookie;
const b = (
  await call("B 가입 (A와 같은 비밀번호)", "/api/auth", {
    action: "register",
    username: "testb_" + suffix,
    password: pw,
  })
).cookie;
const ua = (await call("A 신원", "/api/auth", null, a)).data.user,
  ub = (await call("B 신원", "/api/auth", null, b)).data.user;
await call(
  "중복 가입 거절",
  "/api/auth",
  { action: "register", username: ua.username, password: pw },
  "",
  409,
);
const wrong = (
  await call(
    "존재 계정의 잘못된 비밀번호",
    "/api/auth",
    { action: "login", username: ua.username, password: newPw },
    "",
    401,
  )
).data;
const absent = (
  await call(
    "존재하지 않는 계정",
    "/api/auth",
    { action: "login", username: "absent_" + suffix, password: newPw },
    "",
    401,
  )
).data;
assert.deepEqual(wrong, absent);
const hashes = sql
  .prepare(
    "SELECT username,password_hash FROM users WHERE id IN (?,?) ORDER BY username",
  )
  .all(ua.id, ub.id);
assert.equal(hashes.length, 2);
assert.notEqual(hashes[0].password_hash, hashes[1].password_hash);
assert(
  hashes.every(
    (x) =>
      x.password_hash.startsWith("$2b$12$") && !x.password_hash.includes(pw),
  ),
);
await call("로컬 DB 해시 점검 후 연결 확인", "/api/auth", null, a);
assert.equal(
  (await call("비로그인 첫 화면", "/", null, "", 307)).headers.get("location"),
  "/login",
);
await call("비로그인 자료 API", "/api/data", null, "", 401);
await call("비로그인 내보내기", "/api/export", null, "", 401);
await call("교차 출처 요청 거절", "/api/auth", { action: "logout" }, a, 403, {
  Origin: "https://untrusted.example",
});
const makePlan = (name) => ({
  action: "plan",
  id: uid(),
  title: name,
  start: "2026-10-01",
  end: "2026-10-31",
  priority: "보통",
  success: "테스트용 목표",
  estimate: 120,
  improvement: "",
  starter: true,
});
const pa = makePlan("A 테스트 계획"),
  pb = makePlan("B 테스트 계획");
await call("A 자기 계획 생성", "/api/data", pa, a);
await call("B 자기 계획 생성", "/api/data", pb, b);
const da = (await call("A 자기 목록", "/api/data", null, a)).data,
  db = (await call("B 자기 목록", "/api/data", null, b)).data;
assert.equal(da.plans.length, 1);
assert.equal(db.plans.length, 1);
assert.equal(da.plans[0].owner_id, ua.id);
assert.equal(db.plans[0].owner_id, ub.id);
for (const [name, actor, target, targetData] of [
  ["A→B", a, pb, db],
  ["B→A", b, pa, da],
]) {
  await call(name + " 자기 자료 성공 대조", "/api/data", null, actor);
  await call(
    name + " 타인 읽기 거절",
    "/api/data?table=plans&id=" + target.id,
    null,
    actor,
    404,
  );
  await call(
    name + " 타인 수정 거절",
    "/api/data",
    { ...target, title: "침범", version: 1 },
    actor,
    404,
  );
  await call(
    name + " 타인 삭제 거절",
    "/api/data",
    { action: "delete", id: targetData.tasks[0].id },
    actor,
    404,
  );
  await call(
    name + " 타인 할 일 수정 거절",
    "/api/data",
    { action: "task", ...targetData.tasks[0], title: "침범" },
    actor,
    404,
  );
  await call(
    name + " 타인 완료 거절",
    "/api/data",
    { action: "done", id: targetData.tasks[0].id, done: true },
    actor,
    404,
  );
  await call(
    name + " 타인 실행 기록 추가 거절",
    "/api/data",
    { action: "log", id: uid(), task_id: targetData.tasks[0].id },
    actor,
    404,
  );
  await call(
    name + " 다음 계획 ID 침범 거절",
    "/api/data",
    {
      action: "review",
      id: uid(),
      plan_id: actor === a ? pa.id : pb.id,
      next_id: target.id,
    },
    actor,
    404,
  );
}
assert.deepEqual(
  (await call("공격 후 A 원본 불변", "/api/data", null, a)).data,
  da,
);
const spoof = (
  await call(
    "URL·헤더 소유자 위조에도 본인 목록만",
    "/api/data?owner_id=" + ub.id,
    null,
    a,
    200,
    { "X-User-Id": ub.id },
  )
).data;
assert.deepEqual(spoof, da);
await call(
  "본문 소유자 위조 계획 생성",
  "/api/data",
  { ...makePlan("A 소유 확인"), owner_id: ub.id, user_id: ub.id },
  a,
);
const bAfter = (await call("공격 후 B 자료 불변", "/api/data", null, b)).data;
assert.deepEqual(bAfter, db);
const updated = (await call("공격 후 A 자료 확인", "/api/data", null, a)).data;
assert(updated.plans.every((p) => p.owner_id === ua.id));
assert.equal(updated.tasks.length, 10);
await call(
  "A 자기 기록 단건 성공",
  "/api/data?table=plans&id=" + pa.id,
  null,
  a,
);
await call("비로그인 자료 쓰기 거절", "/api/data", makePlan("거절"), "", 401);
await call(
  "계획 수정 이력 보존",
  "/api/data",
  { ...pa, title: "A 수정", version: 1 },
  a,
);
const task = da.tasks[0];
await call(
  "내 할 일 완료",
  "/api/data",
  { action: "done", id: task.id, done: true },
  a,
);
await call(
  "중복 완료",
  "/api/data",
  { action: "done", id: task.id, done: true },
  a,
);
assert.equal(
  (await call("완료 집계 검증", "/api/data", null, a)).data.completions.length,
  1,
);
await call(
  "관찰 시작",
  "/api/experiment",
  { action: "start", question: "테스트 질문", rule: "테스트 규칙" },
  a,
);
await call(
  "1일차 전에 규칙 변경 거절",
  "/api/experiment",
  { action: "change", rule: "다른 규칙", reason: "테스트" },
  a,
  409,
);
await call(
  "미래 날짜 기록 거절",
  "/api/experiment",
  { action: "day", date: "2099-01-01", minutes: 20, confirmActual: true },
  a,
  400,
);
const today = seoulDate(),
  day = {
    action: "day",
    date: today,
    minutes: 20,
    note: "로컬 테스트",
    confirmActual: true,
  };
await call("오늘 1일차 저장", "/api/experiment", day, a);
await call("동일 요청 재전송 한 건 유지", "/api/experiment", day, a);
await call(
  "같은 날 다른 값 거절",
  "/api/experiment",
  { ...day, minutes: 30 },
  a,
  409,
);
const ex = (await call("관찰 내 계정 조회", "/api/experiment", null, a)).data
  .experiment;
// Explicit synthetic local fixtures: these do NOT represent five real days of user activity.
sql.prepare("DELETE FROM experiment_days WHERE experiment_id=?").run(ex.id);
const beforeDate = (n) => {
  const d = new Date(today + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
};
for (const [i, min] of [
  [1, 20],
  [2, 0],
])
  sql
    .prepare(
      "INSERT INTO experiment_days(id,experiment_id,day_index,date,minutes,note,outlier_confirmed,created) VALUES(?,?,?,?,?,?,0,?)",
    )
    .run(
      uid(),
      ex.id,
      i,
      beforeDate(3 - i),
      min,
      "SYNTHETIC LOCAL FIXTURE",
      beforeDate(3 - i) + "T10:00:00Z",
    );
await call("합성 fixture 후 연결 확인", "/api/experiment", null, a);
await call("3일차 전 규칙 변경 요구", "/api/experiment", day, a, 409);
await call(
  "2일차 뒤 규칙 변경",
  "/api/experiment",
  {
    action: "change",
    rule: "운동 시간을 전날 정한다",
    reason: "로컬 합성 데이터 검증",
  },
  a,
);
await call(
  "규칙 중복 변경 거절",
  "/api/experiment",
  { action: "change", rule: "또 변경", reason: "테스트" },
  a,
  409,
);
await call(
  "이상값 확인 요구",
  "/api/experiment",
  { ...day, minutes: 181 },
  a,
  400,
);
await call("3일차 저장", "/api/experiment", { ...day, minutes: 25 }, a);
assert.equal(
  (await call("B에게 A 관찰 노출 없음", "/api/experiment", null, b)).data
    .experiment,
  null,
);
const exported = (await call("본인 자료 전체 내보내기", "/api/export", null, a))
  .data;
assert.equal(exported.observation.days.length, 3);
assert(exported.diary.plans.every((p) => p.owner_id === ua.id));
assert(!JSON.stringify(exported).includes("password_hash"));
await call("로그아웃 직전 동일 요청 성공", "/api/data", null, a);
await call("로그아웃", "/api/auth", { action: "logout" }, a);
await call("로그아웃 후 같은 쿠키·주소·방식 거절", "/api/data", null, a, 401);
let a2 = (
  await call("A 재로그인", "/api/auth", {
    action: "login",
    username: ua.username,
    password: pw,
  })
).cookie;
const a3 = (
  await call("A 두 번째 세션", "/api/auth", {
    action: "login",
    username: ua.username,
    password: pw,
  })
).cookie;
await call(
  "비밀번호 변경",
  "/api/auth",
  { action: "password", password: pw, newPassword: newPw },
  a2,
);
await call("변경 후 이전 세션1 거절", "/api/data", null, a2, 401);
await call("변경 후 이전 세션2 거절", "/api/data", null, a3, 401);
a2 = (
  await call("변경된 비밀번호 로그인", "/api/auth", {
    action: "login",
    username: ua.username,
    password: newPw,
  })
).cookie;
sql
  .prepare("UPDATE sessions SET expires=? WHERE user_id=?")
  .run("2000-01-01T00:00:00.000Z", ua.id);
await call("만료 세션 거절 (로컬 만료 fixture)", "/api/data", null, a2, 401);
a2 = (
  await call("삭제 전 로그인", "/api/auth", {
    action: "login",
    username: ua.username,
    password: newPw,
  })
).cookie;
await call(
  "계정 삭제",
  "/api/auth",
  { action: "delete", password: newPw, confirm: "계정 삭제" },
  a2,
);
assert.equal(
  sql.prepare("SELECT count(*) AS n FROM users WHERE id=?").get(ua.id).n,
  0,
);
assert.equal(
  sql.prepare("SELECT count(*) AS n FROM plans WHERE owner_id=?").get(ua.id).n,
  0,
);
assert.equal(
  sql
    .prepare("SELECT count(*) AS n FROM experiments WHERE user_id=?")
    .get(ua.id).n,
  0,
);
await call("삭제 후 세션 거절", "/api/data", null, a2, 401);
await call(
  "B 테스트 계정 정리",
  "/api/auth",
  { action: "delete", password: pw, confirm: "계정 삭제" },
  b,
);
for (let i = 1; i <= 16; i++)
  await call(
    "로그인 횟수 제한 " + i,
    "/api/auth",
    { action: "login", username: "ratetest_" + suffix, password: pw },
    "",
    i <= 15 ? 401 : 429,
  );
const evidence = {
  generatedAt: new Date().toISOString(),
  environment: "Local production Worker + D1, not real user activity",
  t06Commit: "704893d03fd11c581da6ecc192192a5458679add",
  passwordHashEvidence: {
    method: "bcryptjs 3.0.3, bcrypt cost 12, independently salted",
    sameInputDifferentStoredHashes: true,
    disposableDeletedTestAccounts: hashes,
  },
  dataIntegrity: {
    oppositeAccountBefore: db,
    oppositeAccountAfter: bAfter,
    unchanged: true,
  },
  fiveDayStatus:
    "User five-day observation NOT performed; temporal tests use explicitly synthetic local fixtures.",
  records,
};
fs.writeFileSync(
  "public/auth-evidence.json",
  JSON.stringify(evidence, null, 2),
);
sql.close();
console.log(
  "PASS: " +
    records.length +
    " authenticated integration checks. Redacted evidence: public/auth-evidence.json. Disposable test accounts deleted.",
);
