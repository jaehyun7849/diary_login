export const experimentRules = {
  missing:
    "미기록은 0으로 바꾸지 않고 제외합니다. 실제 운동을 하지 않았다고 확인한 날만 0분입니다. 완료하려면 서로 다른 실제 날짜 5개의 기록이 필요합니다.",
  duplicate:
    "서울 날짜별 한 기록만 저장합니다. 같은 요청의 재전송은 중복 합산하지 않습니다.",
  outlier:
    "180분 초과는 확인을 요구하고, 확인 후 원래 값 그대로 포함합니다. 0~1440분의 정수만 허용합니다.",
  rounding:
    "합계는 정수, 평균은 합계/기록 수를 계산한 마지막 단계에서 소수 첫째 자리로 반올림합니다.",
  weekStart: "월요일",
  timezone: "Asia/Seoul",
  unit: "분",
  comparison:
    "1~2일차 평균과 3~5일차 평균을 동일한 계산법으로 비교합니다. 양쪽 기록이 모두 채워지기 전에는 잠정값입니다.",
};
export function dailySummary(days) {
  const group = (rows) => ({
    count: rows.length,
    total: rows.reduce((n, r) => n + r.minutes, 0),
    average: rows.length
      ? Math.round(
          (rows.reduce((n, r) => n + r.minutes, 0) / rows.length) * 10,
        ) / 10
      : null,
  });
  return {
    all: group(days),
    before: group(days.filter((d) => d.day_index <= 2)),
    after: group(days.filter((d) => d.day_index >= 3)),
  };
}
