import report from "./report.json";
export default function Source() {
  const sections = report.text.split("\n## ");
  return (
    <main className="standalone documentation">
      <a href="/login">← 한걸음 로그인 화면</a>
      <div className="page-heading">
        <div>
          <div className="eyebrow">IMPLEMENTATION & EVIDENCE</div>
          <h1>어떻게 잠갔는지, 기록으로.</h1>
          <p>과제 7 · 인증 구현 설명과 실제 검증 결과</p>
        </div>
      </div>
      <div className="doc-links">
        <a className="small-btn" href="/source-code.json">
          소스 코드 보기
        </a>
        <a className="small-btn" href="/auth-implementation.md" download>
          설명서 다운로드
        </a>
        <a className="small-btn" href="/auth-evidence.json">
          가린 요청·응답 증거
        </a>
        <a className="small-btn" href="/pds-auth-v3.json">
          인증 DB 명세
        </a>
      </div>
      <section className="account-panel">
        <h2>제출 전 남은 실제 사용</h2>
        <p>
          앱 구현·검증과 본인의 5일 사용은 별개입니다. 본인 계정에서 서로 다른
          실제 날짜 5일을 기록하고, 2일차 뒤 3일차 전에 계획 규칙을 한 번
          변경해야 합니다. 테스트 데이터는 실제 사용 기록으로 계산하지 않습니다.
        </p>
        <p className="helper">
          T06 기준 커밋: 704893d03fd11c581da6ecc192192a5458679add
        </p>
      </section>
      {sections.slice(1).map((section, i) => {
        const end = section.indexOf("\n");
        return (
          <section className="account-panel" key={i}>
            <h2>{section.slice(0, end)}</h2>
            <div className="doc-text">{section.slice(end + 1)}</div>
          </section>
        );
      })}
      <section className="account-panel">
        <h2>실제 요청·응답 확인</h2>
        <p className="helper">
          환경: 로컬 프로덕션 Worker + D1. 테스트 계정의 비밀번호·세션은
          가렸습니다. 아래 계정은 사용자의 실제 계정이 아닙니다.
        </p>
        {report.evidence?.records.map((r, i) => (
          <details className="request-evidence" key={i}>
            <summary>
              <span
                className={
                  r.response.status < 400 ? "status-ok" : "status-denied"
                }
              >
                {r.response.status}
              </span>
              {r.label}
            </summary>
            <pre>
              {JSON.stringify(
                { request: r.request, response: r.response },
                null,
                2,
              )}
            </pre>
          </details>
        ))}
      </section>
    </main>
  );
}
