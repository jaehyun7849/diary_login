import { test } from "node:test";
import assert from "node:assert/strict";
import { dailySummary } from "../lib/experiment.mjs";
test("five-day totals and before/after denominator", () => {
  const s = dailySummary(
    [20, 0, 25, 35, 10].map((minutes, i) => ({ minutes, day_index: i + 1 })),
  );
  assert.deepEqual(s.all, { count: 5, total: 90, average: 18 });
  assert.deepEqual(s.before, { count: 2, total: 20, average: 10 });
  assert.deepEqual(s.after, { count: 3, total: 70, average: 23.3 });
});
test("missing is not zero, confirmed zero counts", () => {
  assert.equal(dailySummary([]).all.average, null);
  assert.equal(dailySummary([{ day_index: 1, minutes: 0 }]).all.average, 0);
});
