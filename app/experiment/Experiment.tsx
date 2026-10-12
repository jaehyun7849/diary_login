"use client";
import { useEffect, useState } from "react";
import { experimentRules } from "../../lib/experiment.mjs";
export default function Experiment() {
  const [state, setState] = useState<any>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [toast, setToast] = useState("");
  async function load() {
    const r = await fetch("/api/experiment", { cache: "no-store" });
    if (r.status === 401) {
      location.replace("/login");
      return;
    }
    const d = (await r.json()) as any;
    if (!r.ok) throw Error(d.error);
    setState(d);
  }
  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, []);
  async function submit(ev: React.FormEvent<HTMLFormElement>, action: string) {
    ev.preventDefault();
    setBusy(true);
    setError("");
    setToast("");
    const f = new FormData(ev.currentTarget);
    try {
      const r = await fetch("/api/experiment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          question: f.get("question"),
          rule: f.get("rule"),
          reason: f.get("reason"),
          minutes: f.get("minutes"),
          note: f.get("note") || "",
          date: state.today,
          confirmActual: f.get("actual") === "on",
          confirmOutlier: f.get("outlier") === "on",
        }),
      });
      if (r.status === 401) {
        location.replace("/login");
        return;
      }
      const d = (await r.json()) as any;
      if (!r.ok) throw Error(d.error);
      setState(d);
      setToast("내 계정에 저장했어요.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const e = state?.experiment,
    days = state?.days || [],
    summary = state?.summary,
    todaySaved = days.some((d: any) => d.date === state?.today);
  return (
    <main className="standalone observation">
      <a href="/">← 내 운동 다이어리</a>
      <div className="page-heading">
        <div>
          <div className="eyebrow">FIVE DAYS, ONE SMALL CHANGE</div>
          <h1>5일, 나의 운동을 관찰해요.</h1>
          <p>처음 2일을 돌아보고, 규칙 하나를 바꾼 뒤 3일을 더 기록해요.</p>
        </div>
        <span className="badge">{state?.today} · 서울</span>
      </div>
      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}
      {toast && (
        <p className="success" role="status">
          {toast}
        </p>
      )}
      {!state ? (
        <p>불러오는 중…</p>
      ) : !e ? (
        <section className="account-panel">
          <h2>1일차 전에 기준을 정해요</h2>
          <p className="helper">
            질문과 계산 기준은 시작 후 고정됩니다. 계획 규칙만 2일차 뒤에 한 번
            바꿉니다.
          </p>
          <form onSubmit={(ev) => submit(ev, "start")}>
            <label>
              이번에 답하고 싶은 질문
              <textarea
                name="question"
                required
                defaultValue="운동 시작 시간을 전날 정하면 하루 실제 운동 시간이 달라질까?"
              />
            </label>
            <label>
              처음 2일의 계획 규칙
              <textarea
                name="rule"
                required
                defaultValue="그날 가능한 시간에 걷기 또는 헬스를 한다."
              />
            </label>
            <p>
              관찰 지표: <strong>하루 실제 운동 시간</strong> · 단위:{" "}
              <strong>분</strong>
            </p>
            <button className="primary" disabled={busy}>
              기준을 정하고 시작하기
            </button>
          </form>
        </section>
      ) : (
        <>
          <section className="hero observation-hero">
            <div className="hero-content">
              <span className="hero-label">MY QUESTION</span>
              <h2>{e.question}</h2>
              <p>하루 실제 운동 시간 · 분 · 서울 날짜 기준</p>
              <div className="goal">
                <span>처음 2일의 규칙</span>
                <strong>{e.initial_rule}</strong>
              </div>
              {e.changed_at && (
                <div className="goal">
                  <span>3일차부터의 규칙</span>
                  <strong>{e.changed_rule}</strong>
                  <p>이유: {e.reason}</p>
                  <p>
                    변경 시각:{" "}
                    {new Date(e.changed_at).toLocaleString("ko-KR", {
                      timeZone: "Asia/Seoul",
                    })}
                  </p>
                </div>
              )}
            </div>
          </section>
          <div className="day-progress">
            {[1, 2, 3, 4, 5].map((i) => {
              const d = days.find((x: any) => x.day_index === i);
              return (
                <div className={d ? "recorded" : ""} key={i}>
                  <span>{i}일차</span>
                  <strong>{d ? d.minutes + "분" : "아직"}</strong>
                  <small>{d ? d.date : i < 3 ? "변경 전" : "변경 후"}</small>
                </div>
              );
            })}
          </div>
          {days.length === 2 && !e.changed_at && (
            <section className="account-panel change-panel">
              <h2>다음 기록 전에 규칙 하나를 바꿔요</h2>
              <p>
                2일차 기록이 끝났어요. 관찰 질문·지표·단위는 그대로 두고 계획
                규칙 하나만 바꿉니다.
              </p>
              <form onSubmit={(ev) => submit(ev, "change")}>
                <label>
                  3~5일차에 적용할 규칙
                  <textarea
                    name="rule"
                    required
                    placeholder="예: 전날 저녁에 다음 날 운동 시작 시간을 정한다."
                  />
                </label>
                <label>
                  바꾸는 이유
                  <textarea
                    name="reason"
                    required
                    placeholder="실제 첫 2일의 경험을 바탕으로 적어주세요."
                  />
                </label>
                <button className="primary" disabled={busy}>
                  규칙 변경 시각과 이유 저장
                </button>
              </form>
            </section>
          )}
          {days.length < 5 && !(days.length === 2 && !e.changed_at) && (
            <section className="account-panel">
              <h2>
                {todaySaved
                  ? "오늘 기록을 남겼어요"
                  : `${days.length + 1}일차 · 오늘의 실제 기록`}
              </h2>
              {todaySaved ? (
                <p>
                  다음 실제 날짜에 돌아와 이어서 기록해 주세요. 같은 날을 여러
                  날로 계산하지 않아요.
                </p>
              ) : (
                <form onSubmit={(ev) => submit(ev, "day")}>
                  <p className="helper">
                    운동한 세션들의 실제 시간을 직접 합산해 입력하세요. 운동하지
                    않았으면 0분, 아직 확인하지 않았다면 저장하지 않습니다.
                  </p>
                  <label>
                    오늘 실제 운동 시간 (분)
                    <input
                      name="minutes"
                      type="number"
                      required
                      min="0"
                      max="1440"
                      step="1"
                    />
                  </label>
                  <label>
                    오늘의 메모
                    <textarea
                      name="note"
                      placeholder="어떤 운동을 했는지, 무엇이 계획과 달랐는지"
                      maxLength={2000}
                    />
                  </label>
                  <label className="checkbox-label">
                    <input name="actual" type="checkbox" required />
                    오늘 실제 시간을 확인했습니다. 기록은 날짜당 한 번 확정되며
                    수정할 수 없습니다.
                  </label>
                  <label className="checkbox-label">
                    <input name="outlier" type="checkbox" />
                    180분이 넘는 경우, 실제 운동 시간이 맞는지 다시
                    확인했습니다.
                  </label>
                  <button className="primary" disabled={busy}>
                    오늘 기록 확정
                  </button>
                </form>
              )}
            </section>
          )}
          <section className="account-panel">
            <h2>
              {days.length === 5 ? "5일의 변화" : "현재까지의 변화 · 잠정값"}
            </h2>
            <div className="stats experiment-stats">
              {[
                ["전체 합계", summary.all.total + "분"],
                [
                  "전체 평균",
                  summary.all.average === null
                    ? "미기록"
                    : summary.all.average + "분",
                ],
                [
                  "변경 전 평균",
                  summary.before.average === null
                    ? "미기록"
                    : summary.before.average + "분",
                ],
                [
                  "변경 후 평균",
                  summary.after.average === null
                    ? "미기록"
                    : summary.after.average + "분",
                ],
              ].map(([label, value]) => (
                <div className="stat" key={label}>
                  <span>{label}</span>
                  <strong>{value}</strong>
                </div>
              ))}
            </div>
            <p className="helper">
              변경 전 {summary.before.count}/2일 · 변경 후 {summary.after.count}
              /3일. 합계 ÷ 실제 기록 수로 평균을 계산합니다. 5일의 변화만으로
              원인을 확정하지 않습니다.
            </p>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>일차</th>
                    <th>서울 날짜</th>
                    <th>실제 시간</th>
                    <th>규칙</th>
                    <th>메모</th>
                  </tr>
                </thead>
                <tbody>
                  {days.map((d: any) => (
                    <tr key={d.id}>
                      <td>{d.day_index}일차</td>
                      <td>{d.date}</td>
                      <td>{d.minutes}분</td>
                      <td>{d.day_index < 3 ? "변경 전" : "변경 후"}</td>
                      <td>{d.note || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p>
              손계산 확인: {days.map((d: any) => d.minutes).join(" + ") || "0"}{" "}
              = {summary.all.total}분
              {days.length > 0 &&
                ` / ${days.length}일 = ${summary.all.average}분`}
            </p>
          </section>
        </>
      )}
      <details className="account-panel" open>
        <summary>고정된 계산·기록 규칙</summary>
        <dl>
          {Object.entries(experimentRules).map(([key, value]) => (
            <div key={key}>
              <dt>
                {
                  {
                    missing: "빠진 값",
                    duplicate: "중복",
                    outlier: "이상값",
                    rounding: "반올림",
                    weekStart: "주 시작",
                    timezone: "시간대",
                    unit: "단위",
                    comparison: "비교",
                  }[key]
                }
              </dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </details>
      <p className="helper">
        테스트 결과는 실제 사용 일수에 포함하지 않습니다. 내보내기에는 이
        기준·규칙 변경·5일 기록이 모두 담깁니다.
      </p>
      <a href="/api/export" download className="small-btn">
        내 자료 전체 내보내기
      </a>
    </main>
  );
}
