import {
  db,
  reply,
  fail,
  HttpError,
  requireUser,
  readBody,
} from "../../../lib/auth";
import { seoulDate } from "../../../lib/metrics.mjs";
import { experimentRules, dailySummary } from "../../../lib/experiment.mjs";
export const dynamic = "force-dynamic";
async function state(uid: string) {
  const experiment = await db()
    .prepare("SELECT * FROM experiments WHERE user_id=?")
    .bind(uid)
    .first<any>();
  const days = experiment
    ? (
        await db()
          .prepare(
            "SELECT * FROM experiment_days WHERE experiment_id=? ORDER BY day_index",
          )
          .bind(experiment.id)
          .all<any>()
      ).results
    : [];
  return { experiment, days, summary: dailySummary(days), today: seoulDate() };
}
export async function GET(req: Request) {
  try {
    const u = await requireUser(req);
    return reply(await state(u.id));
  } catch (e) {
    return fail(e);
  }
}
export async function POST(req: Request) {
  try {
    const b = await readBody(req),
      u = await requireUser(req),
      now = new Date().toISOString(),
      today = seoulDate();
    const text = (v: unknown) => {
      if (typeof v !== "string" || !v.trim() || v.length > 2000)
        throw new HttpError(400, "내용을 1~2000자로 입력하세요.");
      return v.trim();
    };
    if (b.action === "start") {
      await db()
        .prepare(
          "INSERT INTO experiments(id,user_id,question,metric,unit,rules,initial_rule,created) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(user_id) DO NOTHING",
        )
        .bind(
          crypto.randomUUID(),
          u.id,
          text(b.question),
          "하루 실제 운동 시간",
          "분",
          JSON.stringify(experimentRules),
          text(b.rule),
          now,
        )
        .run();
      return reply(await state(u.id));
    }
    const { experiment: e, days } = await state(u.id);
    if (!e) throw new HttpError(400, "먼저 관찰 질문과 계획 규칙을 정하세요.");
    if (b.action === "change") {
      if (days.length !== 2 || e.changed_at)
        throw new HttpError(
          409,
          "규칙은 2일차 기록 뒤, 3일차 기록 전에 한 번 변경합니다.",
        );
      const rule = text(b.rule),
        reason = text(b.reason);
      if (rule === e.initial_rule)
        throw new HttpError(400, "변경할 규칙을 입력하세요.");
      const r = await db()
        .prepare(
          "UPDATE experiments SET changed_rule=?,changed_at=?,reason=? WHERE id=? AND user_id=? AND changed_at IS NULL AND (SELECT count(*) FROM experiment_days WHERE experiment_id=experiments.id)=2",
        )
        .bind(rule, now, reason, e.id, u.id)
        .run();
      if (!r.meta.changes)
        throw new HttpError(
          409,
          "기록 상태가 변경되었습니다. 다시 확인하세요.",
        );
    } else if (b.action === "day") {
      if (b.date !== today)
        throw new HttpError(
          400,
          "서울 기준 오늘의 실제 기록만 남길 수 있습니다.",
        );
      const existing = days.find((d) => d.date === today);
      if (existing) {
        if (
          existing.minutes === Number(b.minutes) &&
          existing.note === (b.note || "")
        )
          return reply(await state(u.id));
        throw new HttpError(
          409,
          "오늘은 이미 기록했습니다. 날짜당 한 번만 기록합니다.",
        );
      }
      if (days.length >= 5)
        throw new HttpError(409, "5일 기록이 완료되었습니다.");
      if (days.length >= 2 && !e.changed_at)
        throw new HttpError(
          409,
          "3일차 전에 계획 규칙 하나를 바꾸고 이유를 남겨주세요.",
        );
      const minutes = Number(b.minutes);
      if (!Number.isInteger(minutes) || minutes < 0 || minutes > 1440)
        throw new HttpError(400, "운동 시간은 0~1440분의 정수여야 합니다.");
      if (minutes > 180 && b.confirmOutlier !== true)
        throw new HttpError(400, "180분 초과 기록이 맞는지 확인해 주세요.");
      if (b.confirmActual !== true)
        throw new HttpError(400, "오늘 실제 운동한 시간임을 확인하세요.");
      const note = typeof b.note === "string" ? b.note : "";
      if (note.length > 2000)
        throw new HttpError(400, "메모는 2000자 이하로 입력하세요.");
      await db()
        .prepare(
          "INSERT INTO experiment_days(id,experiment_id,day_index,date,minutes,note,outlier_confirmed,created) SELECT ?,id,?,?,?,?,?,? FROM experiments WHERE id=? AND user_id=? AND (SELECT count(*) FROM experiment_days WHERE experiment_id=experiments.id)=? ON CONFLICT DO NOTHING",
        )
        .bind(
          crypto.randomUUID(),
          days.length + 1,
          today,
          minutes,
          note,
          minutes > 180 ? 1 : 0,
          now,
          e.id,
          u.id,
          days.length,
        )
        .run();
    } else throw new HttpError(400, "지원하지 않는 요청입니다.");
    return reply(await state(u.id));
  } catch (e) {
    return fail(e);
  }
}
