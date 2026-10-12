"use client";
import { useState, useEffect } from "react";
import {
  Footprints,
  LayoutDashboard,
  ListTodo,
  ChartNoAxesCombined,
  Download,
  Plus,
  ArrowUpRight,
  Check,
  Clock,
  ChevronRight,
  X,
  Dumbbell,
  History,
  ArrowRight,
  CalendarDays,
} from "lucide-react";
import { summarize, seoulDate } from "../lib/metrics.mjs";
type Row = Record<string, any>;
const empty = {
  plans: [],
  tasks: [],
  logs: [],
  reviews: [],
  revisions: [],
  completions: [],
};
const addDays = (d: string, n: number) => {
  const x = new Date(d + "T00:00:00Z");
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
};
const uid = () => crypto.randomUUID();
const stamp = (v: string) =>
  new Date(v).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
export default function Home({ username }: { username: string }) {
  const [data, setData] = useState<Record<string, Row[]>>(empty),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [toast, setToast] = useState(""),
    [tab, setTab] = useState("plan"),
    [selected, setSelected] = useState(""),
    [modal, setModal] = useState<Row | null>(null),
    [busy, setBusy] = useState(false),
    [search, setSearch] = useState(""),
    [filter, setFilter] = useState("all"),
    [tag, setTag] = useState("all"),
    [sort, setSort] = useState("due"),
    [from, setFrom] = useState(""),
    [to, setTo] = useState(""),
    [evidence, setEvidence] = useState("");
  const today = seoulDate(),
    plan = data.plans.find((p) => p.id === selected) || data.plans[0];
  const refresh = async () => {
    const r = await fetch("/api/data", { cache: "no-store" });
    const d = (await r.json()) as any;
    if (r.status === 401) {
      location.replace("/login");
      throw Error("로그인이 만료되었습니다.");
    }
    if (!r.ok) throw Error(d.error);
    setData(d);
    return d;
  };
  useEffect(() => {
    refresh()
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 4000);
    return () => clearTimeout(t);
  }, [toast]);
  const m: Row = summarize(data, plan?.id, from, to, today),
    all = data.tasks.filter((t) => !t.deleted && t.plan_id === plan?.id);
  const mutate = async (payload: Row) => {
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = (await r.json()) as any;
      if (!r.ok) throw Error(result.error);
      await refresh();
      setModal(null);
      setToast("서버에 저장했어요.");
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  };
  const openPlan = (edit = false) =>
    setModal(
      edit
        ? { ...plan, kind: "plan" }
        : {
            kind: "plan",
            id: uid(),
            title: "헬스·걷기 시작하기",
            start: today,
            end: addDays(today, 13),
            priority: "보통",
            success: "운동 5회 중 3회 이상 실천하고 기록 남기기",
            estimate: 120,
            improvement: "",
            starter: !data.plans.length,
          },
    );
  const openTask = (task?: Row) =>
    setModal(
      task
        ? { ...task, kind: "task" }
        : {
            kind: "task",
            id: uid(),
            plan_id: plan.id,
            title: "",
            due: today,
            priority: "보통",
            tag: "걷기",
            estimate: 20,
          },
    );
  const field = (key: string, value: any) =>
    setModal((v) => ({ ...v!, [key]: value }));
  const save = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!modal) return;
    let b: Row = { ...modal, action: modal.kind };
    if (b.action === "log") {
      b.start = b.start + ":00+09:00";
      b.end = b.end + ":00+09:00";
    }
    if (await mutate(b)) {
      if (b.action === "plan") setSelected(b.id);
      if (b.action === "review") {
        setSelected(b.next_id);
        setTab("plan");
        setFrom("");
        setTo("");
      }
    }
  };
  let shown = all.filter(
    (t) =>
      (t.title + " " + t.tag).toLowerCase().includes(search.toLowerCase()) &&
      (tag === "all" || t.tag === tag) &&
      (filter === "all" || (filter === "done" ? t.done : !t.done)),
  );
  shown.sort((a, b) => {
    let n =
      sort === "priority"
        ? ["높음", "보통", "낮음"].indexOf(a.priority) -
          ["높음", "보통", "낮음"].indexOf(b.priority)
        : sort === "estimate"
          ? a.estimate - b.estimate
          : a.due.localeCompare(b.due);
    return n || a.created.localeCompare(b.created) || a.id.localeCompare(b.id);
  });
  const exportData = () => {
    location.href = "/api/export";
  };
  const logout = async () => {
    setBusy(true);
    try {
      const r = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "logout" }),
      });
      if (!r.ok && r.status !== 401)
        throw Error("로그아웃하지 못했습니다. 다시 시도하세요.");
      location.replace("/login");
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };
  const card = (t: Row) => (
    <article className="task" key={t.id}>
      <button
        disabled={busy}
        className={"check " + (t.done ? "checked" : "")}
        aria-label={t.done ? "완료 취소: " + t.title : "완료: " + t.title}
        onClick={() => mutate({ action: "done", id: t.id, done: !t.done })}
      >
        {!!t.done && <Check size={16} />}
      </button>
      <div className="task-main">
        <div className="task-title">
          <strong className={t.done ? "strike" : ""}>{t.title}</strong>
          <span className={"badge " + (t.tag === "헬스" ? "purple" : "")}>
            {t.tag}
          </span>
        </div>
        <div className="meta">
          <span>{t.due}</span>
          <span>예상 {t.estimate}분</span>
          <span>우선순위 {t.priority}</span>
          {!t.done && t.due < today && <span className="late">지연</span>}
        </div>
      </div>
      <div className="task-actions">
        <button
          className="text-btn"
          onClick={() => setModal({ kind: "detail", task: t })}
        >
          기록 {data.logs.filter((l) => l.task_id === t.id).length}
        </button>
        <button
          className="small-btn"
          onClick={() =>
            setModal({
              kind: "log",
              id: uid(),
              task_id: t.id,
              title: t.title,
              start: today + "T18:00",
              end: today + "T18:20",
              minutes: 20,
              note: "",
              blocker: "",
            })
          }
        >
          운동 기록
        </button>
        <button
          className="icon-btn"
          aria-label={"수정: " + t.title}
          onClick={() => openTask(t)}
        >
          ···
        </button>
      </div>
    </article>
  );
  return (
    <div className="app">
      <aside>
        <a className="brand" href="/">
          <span className="brand-icon">
            <Footprints size={25} />
          </span>
          한걸음<span className="brand-dot">.</span>
        </a>
        <div className="aside-caption">MY MOVEMENT JOURNAL</div>
        <nav>
          {[
            ["plan", "계획 세우기", LayoutDashboard],
            ["tasks", "운동 기록", ListTodo],
            ["review", "돌아보기", ChartNoAxesCombined],
          ].map(([id, label, Icon]: any) => (
            <button
              key={id}
              className={tab === id ? "active" : ""}
              onClick={() => {
                setTab(id);
                setEvidence("");
              }}
            >
              <Icon size={19} />
              {label}
              <ChevronRight size={15} />
            </button>
          ))}
        </nav>
        <div className="extra-nav">
          <a href="/experiment">◷ 5일 습관 관찰</a>
          <a href="/account">내 계정 관리</a>
          <button onClick={logout} disabled={busy}>
            로그아웃
          </button>
        </div>
        <div className="aside-note">
          <div className="tiny">작은 시작, 나만의 속도</div>
          <p>
            완벽한 계획보다
            <br />
            오늘의 한 걸음.
          </p>
          <div className="path-art">
            <span />
            <span />
            <span />
            <Footprints size={30} />
          </div>
        </div>
        <button className="export" onClick={exportData}>
          <Download size={17} />
          전체 기록 내보내기
        </button>
        <div className="aside-footer">PLAN · DO · SEE</div>
      </aside>
      <div className="workspace">
        <header>
          <span>
            나의 운동 다이어리 <span className="slash">/</span>{" "}
            {tab === "plan"
              ? "계획 세우기"
              : tab === "tasks"
                ? "운동 기록"
                : "돌아보기"}
          </span>
          <span className="date">
            <CalendarDays size={15} />
            {today} · 서울
          </span>
        </header>
        <main>
          <div className="notice">
            <span className="notice-dot" />
            {username}님의 개인 다이어리입니다. 계획·운동 기록·돌아보기는
            로그인한 본인만 볼 수 있습니다.
          </div>
          <div className="page-heading">
            <div>
              <div className="eyebrow">YOUR PACE, YOUR PROGRESS</div>
              <h1>
                {tab === "plan"
                  ? "꾸준함은, 한 걸음부터."
                  : tab === "tasks"
                    ? "오늘의 움직임을 남겨요."
                    : "기록에서 다음 걸음을 찾아요."}
              </h1>
              <p>
                {tab === "plan"
                  ? "걷기든 헬스든 좋아요. 나에게 맞는 운동 습관을 만들어가요."
                  : tab === "tasks"
                    ? "계획과 실제는 달라도 괜찮아요. 있는 그대로 기록해 보세요."
                    : "얼마나 했는지, 무엇이 달랐는지. 다음 계획을 더 나답게."}
              </p>
            </div>
            <button className="primary" onClick={() => openPlan()}>
              <Plus size={17} />새 계획
            </button>
          </div>
          {error && (
            <div role="alert" className="error">
              {error}
              <button
                onClick={() =>
                  refresh()
                    .then(() => setError(""))
                    .catch((e) => setError(e.message))
                }
              >
                다시 불러오기
              </button>
            </div>
          )}
          {loading ? (
            <section className="empty">기록을 불러오고 있어요…</section>
          ) : !plan ? (
            <section className="onboarding">
              <div className="onboarding-icon">
                <Footprints size={38} />
              </div>
              <div className="eyebrow">LET'S TAKE THE FIRST STEP</div>
              <h2>아직 기록이 없어도 괜찮아요.</h2>
              <p>
                걷기 3회와 헬스 2회로 시작하는 2주 계획을 준비했어요.
                <br />
                날짜와 목표를 확인하고 내 첫 계획으로 저장해 보세요.
              </p>
              <button className="primary" onClick={() => openPlan()}>
                첫 운동 계획 만들기 <ArrowRight size={17} />
              </button>
              <small>
                계획 초안만 준비됩니다. 실제 운동 기록은 직접 남겨주세요.
              </small>
            </section>
          ) : (
            <>
              <div className="plan-picker">
                <span>현재 계획</span>
                <select
                  aria-label="현재 계획"
                  value={plan.id}
                  onChange={(e) => {
                    setSelected(e.target.value);
                    setFrom("");
                    setTo("");
                    setEvidence("");
                  }}
                >
                  {data.plans.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))}
                </select>
                <span className="saved">
                  <span />
                  서버 저장
                </span>
              </div>
              {tab === "plan" && (
                <>
                  <section className="hero">
                    <div className="hero-content">
                      <span className="hero-label">
                        MY PLAN <span>우선순위 {plan.priority}</span>
                      </span>
                      <h2>{plan.title}</h2>
                      <p>
                        {plan.start} — {plan.end}
                      </p>
                      <div className="goal">
                        <span>나의 성공 기준</span>
                        <strong>{plan.success}</strong>
                      </div>
                      {plan.improvement && (
                        <p className="carry">
                          이전 돌아보기에서 가져온 한 줄 · {plan.improvement}
                        </p>
                      )}
                      <div className="hero-buttons">
                        <button onClick={() => openPlan(true)}>
                          계획 수정 <ArrowUpRight size={14} />
                        </button>
                        <button onClick={() => setModal({ kind: "history" })}>
                          <History size={14} />
                          수정 이력{" "}
                          {
                            data.revisions.filter((r) => r.plan_id === plan.id)
                              .length
                          }
                        </button>
                      </div>
                    </div>
                    <div className="hero-visual">
                      <div className="orbit" />
                      <div className="walk-symbol">
                        <Footprints size={64} />
                      </div>
                      <span className="floating-label">ONE STEP AT A TIME</span>
                    </div>
                  </section>
                  <div className="stats">
                    {[
                      ["예정된 운동", all.length, "회"],
                      ["완료한 운동", all.filter((t) => t.done).length, "회"],
                      [
                        "실행 기록",
                        data.logs.filter((l) =>
                          all.some((t) => t.id === l.task_id),
                        ).length,
                        "개",
                      ],
                      ["계획 예상 시간", plan.estimate, "분"],
                    ].map(([l, n, u]) => (
                      <button
                        key={l}
                        className="stat"
                        onClick={() => {
                          if (l === "계획 예상 시간") {
                            openPlan(true);
                          } else {
                            setTab("tasks");
                            setFilter(l === "완료한 운동" ? "done" : "all");
                          }
                        }}
                      >
                        <span>{l}</span>
                        <strong>
                          {n}
                          <small>{u}</small>
                        </strong>
                        <ArrowUpRight size={16} />
                      </button>
                    ))}
                  </div>
                  <div className="section-title">
                    <div>
                      <h2>이번 계획의 운동</h2>
                      <p>작은 약속을 하나씩 실천해 보세요.</p>
                    </div>
                    <button className="small-btn" onClick={() => openTask()}>
                      <Plus size={15} />할 일 추가
                    </button>
                  </div>
                  <section className="task-list">
                    {all.length ? (
                      all
                        .slice()
                        .sort(
                          (a, b) =>
                            a.due.localeCompare(b.due) ||
                            a.id.localeCompare(b.id),
                        )
                        .map(card)
                    ) : (
                      <div className="empty">
                        이 계획에 할 일을 추가해 보세요.
                      </div>
                    )}
                  </section>
                  <div className="bottom-tip">
                    <span>
                      01 PLAN <ArrowRight size={14} /> 02 DO{" "}
                      <ArrowRight size={14} /> 03 SEE
                    </span>
                    <p>운동을 마친 뒤 실제 시간과 느낀 점을 남겨보세요.</p>
                  </div>
                </>
              )}
              {tab === "tasks" && (
                <>
                  <div className="toolbar">
                    <input
                      aria-label="운동 검색"
                      placeholder="운동 이름 또는 태그 검색"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                    <select
                      aria-label="상태 필터"
                      value={filter}
                      onChange={(e) => setFilter(e.target.value)}
                    >
                      <option value="all">모든 상태</option>
                      <option value="todo">진행 중</option>
                      <option value="done">완료</option>
                    </select>
                    <select
                      aria-label="태그 필터"
                      value={tag}
                      onChange={(e) => setTag(e.target.value)}
                    >
                      <option value="all">모든 태그</option>
                      {Array.from(new Set(all.map((t) => t.tag))).map((t) => (
                        <option key={t}>{t}</option>
                      ))}
                    </select>
                    <select
                      aria-label="정렬 기준"
                      value={sort}
                      onChange={(e) => setSort(e.target.value)}
                    >
                      <option value="due">마감일 빠른순</option>
                      <option value="priority">우선순위 높은순</option>
                      <option value="estimate">예상 시간 짧은순</option>
                    </select>
                    <button className="primary" onClick={() => openTask()}>
                      <Plus size={16} />할 일
                    </button>
                  </div>
                  <p className="helper">
                    같은 값이면 생성 시각 → ID 순으로 정렬합니다. ·{" "}
                    {shown.length}개
                  </p>
                  <section className="task-list">
                    {shown.length ? (
                      shown.map(card)
                    ) : (
                      <div className="empty">조건에 맞는 운동이 없어요.</div>
                    )}
                  </section>
                </>
              )}
              {tab === "review" && (
                <>
                  <div className="toolbar">
                    <label>
                      마감일 기준{" "}
                      <input
                        type="date"
                        aria-label="집계 시작일"
                        value={from}
                        onChange={(e) => setFrom(e.target.value)}
                      />
                    </label>
                    <span>—</span>
                    <input
                      type="date"
                      aria-label="집계 종료일"
                      min={from}
                      value={to}
                      onChange={(e) => setTo(e.target.value)}
                    />
                    <button
                      className="text-btn"
                      onClick={() => {
                        setFrom("");
                        setTo("");
                      }}
                    >
                      전체 기간
                    </button>
                  </div>
                  <p className="helper">
                    선택 기간에 마감하는 할 일을 집계합니다. 지연 여부는 서울
                    기준 오늘로 판단합니다.
                  </p>
                  <div className="stats">
                    {[
                      ["계획 수", m.tasks.length, "tasks"],
                      ["완료 수", m.done.length, "done"],
                      ["지연 수", m.late.length, "late"],
                      ["막힘 수", m.blocked.length, "blocked"],
                    ].map(([label, n, key]) => (
                      <button
                        key={key}
                        className="stat"
                        onClick={() => setEvidence(key)}
                      >
                        <span>{label}</span>
                        <strong>
                          {n}
                          <small>회</small>
                        </strong>
                        <ArrowUpRight size={16} />
                      </button>
                    ))}
                  </div>
                  <section className="time-comparison">
                    <div>
                      <h2>예상과 실제, 얼마나 달랐을까요?</h2>
                      <p>실제 시간 − 예상 시간 · 단위: 분</p>
                    </div>
                    <div className="time-values">
                      <button onClick={() => setEvidence("tasks")}>
                        <span>예상 시간</span>
                        <strong>
                          {m.expected}
                          <small>분</small>
                        </strong>
                      </button>
                      <button onClick={() => setEvidence("logs")}>
                        <span>실제 시간</span>
                        <strong>
                          {m.actual}
                          <small>분</small>
                        </strong>
                      </button>
                      <button onClick={() => setEvidence("logs")}>
                        <span>시간 차이</span>
                        <strong>
                          {m.difference > 0 ? "+" : ""}
                          {m.difference}
                          <small>분</small>
                        </strong>
                      </button>
                    </div>
                  </section>
                  {evidence && (
                    <section className="evidence">
                      <div className="section-title">
                        <h2>숫자의 근거 기록</h2>
                        <button
                          className="text-btn"
                          onClick={() => setEvidence("")}
                        >
                          닫기
                        </button>
                      </div>
                      {evidence === "logs" ? (
                        m.logs.length ? (
                          m.logs.map((l: Row) => (
                            <div className="log" key={l.id}>
                              <strong>
                                {all.find((t) => t.id === l.task_id)?.title} ·{" "}
                                {l.minutes}분
                              </strong>
                              <p>
                                {stamp(l.start)} — {stamp(l.end)}
                              </p>
                              <p>
                                {l.note || "메모 없음"}{" "}
                                {l.blocker && "· 막힌 이유: " + l.blocker}
                              </p>
                            </div>
                          ))
                        ) : (
                          <p>실행 기록이 없습니다.</p>
                        )
                      ) : m[evidence].length ? (
                        m[evidence].map(card)
                      ) : (
                        <p>해당하는 할 일이 없습니다.</p>
                      )}
                    </section>
                  )}
                  <section className="reflection">
                    <div>
                      <div className="eyebrow">SEE → NEXT PLAN</div>
                      <h2>다음에는 무엇을 바꿔볼까요?</h2>
                      <p>
                        이번 기록에서 발견한 한 가지를 다음 계획으로 가져가요.
                      </p>
                    </div>
                    <button
                      className="primary"
                      onClick={() =>
                        setModal({
                          kind: "review",
                          id: uid(),
                          plan_id: plan.id,
                          start: from || plan.start,
                          end: to || plan.end,
                          note: "",
                          improvement: "",
                          next_id: uid(),
                          next_title: "다음 운동 계획",
                          next_start: addDays(plan.end, 1),
                          next_end: addDays(plan.end, 14),
                        })
                      }
                    >
                      돌아보기 작성 <ArrowRight size={16} />
                    </button>
                  </section>
                  {data.reviews
                    .filter((r) => r.plan_id === plan.id)
                    .map((r) => (
                      <section className="review-entry" key={r.id}>
                        <span className="eyebrow">
                          {r.start} — {r.end}
                        </span>
                        <h3>{r.improvement}</h3>
                        <p>{r.note}</p>
                        <button
                          className="text-btn"
                          onClick={() => {
                            setSelected(r.next_plan_id);
                            setTab("plan");
                            setFrom("");
                            setTo("");
                          }}
                        >
                          연결된 다음 계획 보기 →
                        </button>
                      </section>
                    ))}
                </>
              )}
            </>
          )}
          <footer>
            한걸음 · 나의 계획과 실제를 담는 운동 다이어리{" "}
            <a href="/source">소스·제출 안내</a>
          </footer>
        </main>
      </div>
      {toast && (
        <div className="toast" role="status">
          <Check size={17} />
          {toast}
        </div>
      )}
      {modal && (
        <div
          className="modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget && !busy) setModal(null);
          }}
        >
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label="기록 편집"
          >
            <div className="modal-header">
              <h2>
                {
                  {
                    plan: "운동 계획",
                    task: "운동 할 일",
                    log: "실제로 한 운동",
                    history: "계획 수정 이력",
                    review: "돌아보고 다음 계획으로",
                    detail: "실행 기록",
                  }[modal.kind as string]
                }
              </h2>
              <button
                className="icon-btn"
                aria-label="닫기"
                disabled={busy}
                onClick={() => setModal(null)}
              >
                <X />
              </button>
            </div>
            {error && (
              <div role="alert" className="error">
                {error}
              </div>
            )}
            {modal.kind === "history" ? (
              <div>
                {data.revisions
                  .filter((r) => r.plan_id === plan.id)
                  .sort((a, b) => b.created.localeCompare(a.created))
                  .map((r) => {
                    const p = JSON.parse(r.snapshot);
                    return (
                      <article className="log" key={r.id}>
                        <strong>
                          버전 {p.version} · {p.title}
                        </strong>
                        <p>
                          {p.start} — {p.end} · {p.priority} · {p.estimate}분
                        </p>
                        <p>{p.success}</p>
                        <p>{p.improvement}</p>
                        <small>
                          수정 시각 {stamp(r.created)} · 원래 ID {p.id}
                        </small>
                      </article>
                    );
                  })}
                {!data.revisions.some((r) => r.plan_id === plan.id) && (
                  <p>
                    아직 수정 이력이 없습니다. 계획을 수정하면 이전 내용이
                    여기에 남아요.
                  </p>
                )}
              </div>
            ) : modal.kind === "detail" ? (
              <>
                <h3>{modal.task.title}</h3>
                {data.logs
                  .filter((l) => l.task_id === modal.task.id)
                  .map((l) => (
                    <article className="log" key={l.id}>
                      <strong>{l.minutes}분</strong>
                      <p>
                        {stamp(l.start)} — {stamp(l.end)}
                      </p>
                      <p>{l.note || "메모 없음"}</p>
                      {l.blocker && <p>막힌 이유: {l.blocker}</p>}
                    </article>
                  ))}
                {!data.logs.some((l) => l.task_id === modal.task.id) && (
                  <p>아직 운동 기록이 없습니다.</p>
                )}
              </>
            ) : (
              <form onSubmit={save}>
                {["plan", "task"].includes(modal.kind) && (
                  <>
                    <label>
                      제목
                      <input
                        required
                        maxLength={200}
                        value={modal.title}
                        onChange={(e) => field("title", e.target.value)}
                      />
                    </label>
                    <div className="form-row">
                      {modal.kind === "plan" ? (
                        <>
                          <label>
                            시작일
                            <input
                              required
                              type="date"
                              value={modal.start}
                              onChange={(e) => field("start", e.target.value)}
                            />
                          </label>
                          <label>
                            종료일
                            <input
                              required
                              type="date"
                              min={modal.start}
                              value={modal.end}
                              onChange={(e) => field("end", e.target.value)}
                            />
                          </label>
                        </>
                      ) : (
                        <label>
                          마감일
                          <input
                            required
                            type="date"
                            value={modal.due}
                            onChange={(e) => field("due", e.target.value)}
                          />
                        </label>
                      )}
                    </div>
                    <div className="form-row">
                      <label>
                        우선순위
                        <select
                          value={modal.priority}
                          onChange={(e) => field("priority", e.target.value)}
                        >
                          {["높음", "보통", "낮음"].map((p) => (
                            <option key={p}>{p}</option>
                          ))}
                        </select>
                      </label>
                      <label>
                        예상 시간 (분)
                        <input
                          required
                          type="number"
                          min="0"
                          max="100000"
                          value={modal.estimate}
                          onChange={(e) => field("estimate", e.target.value)}
                        />
                      </label>
                    </div>
                    {modal.kind === "plan" ? (
                      <>
                        <label>
                          성공 기준
                          <textarea
                            required
                            value={modal.success}
                            onChange={(e) => field("success", e.target.value)}
                          />
                        </label>
                        <label>
                          다음에 반영할 점
                          <textarea
                            value={modal.improvement}
                            onChange={(e) =>
                              field("improvement", e.target.value)
                            }
                          />
                        </label>
                        {!modal.version && (
                          <label className="checkbox-label">
                            <input
                              type="checkbox"
                              checked={!!modal.starter}
                              onChange={(e) =>
                                field("starter", e.target.checked)
                              }
                            />
                            걷기 3회·헬스 2회 초안 함께 만들기 (총 120분, 저장
                            후 수정 가능)
                          </label>
                        )}
                      </>
                    ) : (
                      <label>
                        태그
                        <input
                          required
                          list="tags"
                          value={modal.tag}
                          onChange={(e) => field("tag", e.target.value)}
                        />
                        <datalist id="tags">
                          <option>걷기</option>
                          <option>헬스</option>
                        </datalist>
                      </label>
                    )}
                  </>
                )}
                {modal.kind === "log" && (
                  <>
                    <p className="helper">
                      {modal.title} · 실제로 수행한 운동만 입력해 주세요.
                    </p>
                    <div className="form-row">
                      <label>
                        시작 시각 (서울)
                        <input
                          required
                          type="datetime-local"
                          value={modal.start}
                          onChange={(e) => field("start", e.target.value)}
                        />
                      </label>
                      <label>
                        종료 시각 (서울)
                        <input
                          required
                          type="datetime-local"
                          min={modal.start}
                          value={modal.end}
                          onChange={(e) => field("end", e.target.value)}
                        />
                      </label>
                    </div>
                    <label>
                      실제 운동 시간 (분)
                      <input
                        required
                        type="number"
                        min="0"
                        max="100000"
                        value={modal.minutes}
                        onChange={(e) => field("minutes", e.target.value)}
                      />
                    </label>
                    <p className="helper">
                      휴식 시간을 제외한 실제 운동 시간을 입력할 수 있어요.
                    </p>
                    <label>
                      실제로 한 내용
                      <textarea
                        value={modal.note}
                        onChange={(e) => field("note", e.target.value)}
                      />
                    </label>
                    <label>
                      막혔던 이유 (없으면 비워두기)
                      <textarea
                        value={modal.blocker}
                        onChange={(e) => field("blocker", e.target.value)}
                      />
                    </label>
                    <p className="helper">
                      실행 기록 저장과 할 일 완료 표시는 별개입니다. 운동을
                      마쳤다면 목록에서 완료를 체크해 주세요.
                    </p>
                  </>
                )}
                {modal.kind === "review" && (
                  <>
                    <div className="form-row">
                      <label>
                        돌아보기 시작일
                        <input
                          required
                          type="date"
                          value={modal.start}
                          onChange={(e) => field("start", e.target.value)}
                        />
                      </label>
                      <label>
                        종료일
                        <input
                          required
                          type="date"
                          min={modal.start}
                          value={modal.end}
                          onChange={(e) => field("end", e.target.value)}
                        />
                      </label>
                    </div>
                    <label>
                      이번 운동을 돌아보면
                      <textarea
                        value={modal.note}
                        onChange={(e) => field("note", e.target.value)}
                        placeholder="계획과 실제가 달랐던 점을 적어보세요."
                      />
                    </label>
                    <label>
                      다음 계획으로 가져갈 한 가지
                      <textarea
                        required
                        value={modal.improvement}
                        onChange={(e) => field("improvement", e.target.value)}
                        placeholder="예: 운동할 수 있는 시간에 맞춰 계획 조정하기"
                      />
                    </label>
                    <label>
                      다음 계획 이름
                      <input
                        required
                        value={modal.next_title}
                        onChange={(e) => field("next_title", e.target.value)}
                      />
                    </label>
                    <div className="form-row">
                      <label>
                        다음 시작일
                        <input
                          required
                          type="date"
                          value={modal.next_start}
                          onChange={(e) => field("next_start", e.target.value)}
                        />
                      </label>
                      <label>
                        다음 종료일
                        <input
                          required
                          type="date"
                          min={modal.next_start}
                          value={modal.next_end}
                          onChange={(e) => field("next_end", e.target.value)}
                        />
                      </label>
                    </div>
                  </>
                )}
                <div className="form-footer">
                  {modal.kind === "task" &&
                    data.tasks.some((t) => t.id === modal.id) && (
                      <button
                        type="button"
                        className="danger"
                        disabled={busy}
                        onClick={() => {
                          if (
                            confirm(
                              "이 할 일을 삭제할까요? 실행 기록은 내보내기에 보존됩니다.",
                            )
                          )
                            mutate({ action: "delete", id: modal.id });
                        }}
                      >
                        할 일 삭제
                      </button>
                    )}
                  <button className="primary" disabled={busy} type="submit">
                    {busy
                      ? "저장 중…"
                      : modal.kind === "review"
                        ? "저장하고 다음 계획 만들기"
                        : "저장하기"}
                  </button>
                </div>
              </form>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
