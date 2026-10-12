"use client";
import { useState } from "react";
import { Footprints, LockKeyhole, ArrowRight } from "lucide-react";
export default function AuthForm() {
  const [register, setRegister] = useState(false),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const f = new FormData(e.currentTarget);
    try {
      if (register && f.get("password") !== f.get("repeat"))
        throw Error("비밀번호 확인이 일치하지 않습니다.");
      const r = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: register ? "register" : "login",
          username: f.get("username"),
          password: f.get("password"),
        }),
      });
      const d = (await r.json()) as any;
      if (!r.ok) throw Error(d.error);
      location.replace("/");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="auth-page">
      <div className="auth-story">
        <a className="brand" href="/login">
          <span className="brand-icon">
            <Footprints />
          </span>
          한걸음.
        </a>
        <div className="eyebrow">YOUR PRIVATE MOVEMENT JOURNAL</div>
        <h1>
          나의 걸음은,
          <br />
          나만의 기록으로.
        </h1>
        <p>
          계획하고, 움직이고, 돌아보는 시간.
          <br />
          이제 나만 볼 수 있는 운동 다이어리에서 시작해요.
        </p>
        <div className="auth-steps">
          <span>01 계획</span>
          <ArrowRight size={17} />
          <span>02 실행</span>
          <ArrowRight size={17} />
          <span>03 돌아보기</span>
        </div>
        <p className="helper">과제 7 · 5일 동안 나의 운동 습관을 관찰해요.</p>
      </div>
      <section className="auth-card">
        <LockKeyhole className="auth-lock" size={27} />
        <h2>{register ? "내 다이어리 만들기" : "다시 만나서 반가워요"}</h2>
        <p className="helper">
          {register
            ? "아이디와 비밀번호로 나만의 공간을 만들어요."
            : "로그인하면 내 계획과 운동 기록을 볼 수 있어요."}
        </p>
        <div className="auth-tabs">
          <button
            onClick={() => {
              setRegister(false);
              setError("");
            }}
            className={!register ? "active" : ""}
          >
            로그인
          </button>
          <button
            onClick={() => {
              setRegister(true);
              setError("");
            }}
            className={register ? "active" : ""}
          >
            회원가입
          </button>
        </div>
        <form onSubmit={submit} key={register ? "register" : "login"}>
          <label>
            아이디
            <input
              name="username"
              required
              pattern="[a-z0-9_]{4,32}"
              minLength={4}
              maxLength={32}
              autoComplete="username"
              placeholder="영문 소문자·숫자·밑줄 4~32자"
            />
          </label>
          <label>
            비밀번호
            <input
              name="password"
              type="password"
              required
              minLength={12}
              maxLength={72}
              autoComplete={register ? "new-password" : "current-password"}
              placeholder="12자 이상, UTF-8 72바이트 이하"
            />
          </label>
          {register && (
            <label>
              비밀번호 확인
              <input
                name="repeat"
                type="password"
                required
                minLength={12}
                maxLength={72}
                autoComplete="new-password"
              />
            </label>
          )}
          {error && (
            <div className="error" role="alert">
              {error}
            </div>
          )}
          <button className="primary full" disabled={busy}>
            {busy ? "확인 중…" : register ? "가입하고 시작하기" : "로그인"}
            <ArrowRight size={16} />
          </button>
        </form>
        <p className="helper">
          개인 기록은 로그인한 본인만 볼 수 있습니다.
          <br />
          비밀번호 찾기는 아직 지원하지 않으니 안전하게 보관해 주세요.
        </p>
        <a href="/source" className="source-link">
          소스 · 인증 구현 설명 · 검증 결과
        </a>
      </section>
    </main>
  );
}
