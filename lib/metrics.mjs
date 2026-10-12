export const seoulDate = (instant = new Date()) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant);
export function summarize(data, planId, start, end, today = seoulDate()) {
  const tasks = data.tasks.filter(
    (t) =>
      !t.deleted &&
      t.plan_id === planId &&
      (!start || t.due >= start) &&
      (!end || t.due <= end),
  );
  const ids = new Set(tasks.map((t) => t.id)),
    logs = data.logs.filter((l) => ids.has(l.task_id));
  const done = tasks.filter((t) => t.done === 1),
    late = tasks.filter((t) => !t.done && t.due < today),
    blocked = tasks.filter((t) =>
      logs.some((l) => l.task_id === t.id && l.blocker.trim()),
    );
  const expected = tasks.reduce((n, t) => n + t.estimate, 0),
    actual = logs.reduce((n, l) => n + l.minutes, 0);
  return {
    tasks,
    logs,
    done,
    late,
    blocked,
    expected,
    actual,
    difference: actual - expected,
  };
}
