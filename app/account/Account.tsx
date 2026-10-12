"use client";
import { useState } from "react";
export default function Account({ username }: { username: string }) {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function send(e: React.FormEvent<HTMLFormElement>, action: string) {
    e.preventDefault();
    setError("");
    setBusy(true);
    const f = new FormData(e.currentTarget);
    try {
      if (action === "password" && f.get("newPassword") !== f.get("repeat"))
        throw Error("새 비밀번호 확인이 일치하지 않습니다.");
      const r = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          password: f.get("password"),
          newPassword: f.get("newPassword"),
          confirm: f.get("confirm"),
        }),
      });
      const d = (await r.json()) as any;
      if (!r.ok) throw Error(d.error);
      location.replace("/login");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="standalone">
      <a href="/">← 내 다이어리</a>
      <div className="page-heading">
        <div>
          <div className="eyebrow">MY ACCOUNT</div>
          <h1>내 계정 관리</h1>
          <p>{username} · 로그인은 최대 24시간 유지됩니다.</p>
        </div>
      </div>
      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}
      <section className="account-panel">
        <h2>비밀번호 변경</h2>
        <p className="helper">변경하면 모든 기기의 기존 로그인이 종료됩니다.</p>
        <form onSubmit={(e) => send(e, "password")}>
          <label>
            현재 비밀번호
            <input
              type="password"
              name="password"
              required
              autoComplete="current-password"
            />
          </label>
          <label>
            새 비밀번호
            <input
              type="password"
              name="newPassword"
              required
              minLength={12}
              maxLength={72}
              autoComplete="new-password"
            />
          </label>
          <label>
            새 비밀번호 확인
            <input
              type="password"
              name="repeat"
              required
              autoComplete="new-password"
            />
          </label>
          <button className="primary" disabled={busy}>
            변경하고 로그아웃
          </button>
        </form>
      </section>
      <section className="account-panel">
        <h2>내 자료 내보내기</h2>
        <p>
          계획·할 일·실행 기록·수정 이력·돌아보기·5일 사용 기록을 JSON 하나로
          받습니다. 비밀번호와 세션은 포함되지 않습니다.
        </p>
        <a href="/api/export" download className="small-btn">
          전체 자료 다운로드
        </a>
      </section>
      <section className="account-panel danger-panel">
        <h2>계정 삭제</h2>
        <p>
          계정과 모든 개인 자료를 운영 데이터베이스에서 함께 삭제합니다. 되돌릴
          수 없으니 필요한 자료를 먼저 내보내세요. 이미 내려받은 파일은 직접
          삭제해야 합니다.
        </p>
        <form onSubmit={(e) => send(e, "delete")}>
          <label>
            현재 비밀번호
            <input
              name="password"
              type="password"
              required
              autoComplete="current-password"
            />
          </label>
          <label>
            확인 문구: 계정 삭제
            <input name="confirm" required placeholder="계정 삭제" />
          </label>
          <button className="danger-button" disabled={busy}>
            계정과 내 자료 영구 삭제
          </button>
        </form>
      </section>
    </main>
  );
}
