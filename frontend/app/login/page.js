"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, LockKeyhole, Mail, ShieldCheck, Sparkles } from "lucide-react";
import { login, verifyTwoFactor } from "../../lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [challenge, setChallenge] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function routeUser(user) {
    if (user.role === "system_admin") router.push("/admin");
    else if (user.role === "school_admin") router.push("/school-admin");
    else router.push("/student");
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const result = await login(identifier, password);
      if (result.requiresTwoFactor) {
        setChallenge(result);
        setCode("");
      } else {
        routeUser(result);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify(event) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const user = await verifyTwoFactor(challenge.challengeId, code);
      routeUser(user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-shell">
      <section className="welcome-panel" aria-label="EduClub welcome">
        <div className="sun-badge">EC</div>
        <div>
          <p className="eyebrow">Creative club learning</p>
          <h1>EduClub</h1>
          <p className="welcome-copy">
            A calm, colourful space for schools to guide learners, celebrate progress, and keep every term beautifully organised.
          </p>
        </div>
        <div className="mini-board" aria-hidden="true">
          <span>Courses</span>
          <strong>Progress</strong>
          <span>Typing</span>
          <strong>Reports</strong>
        </div>
      </section>
      <section className="auth-panel">
        <div className="auth-panel-header">
          <span className="auth-kicker"><Sparkles size={15} />Welcome back</span>
          <p className="eyebrow">Welcome back</p>
          <h2>Sign in to continue</h2>
          <p>Open your EduClub workspace and keep every learner moving forward.</p>
        </div>
        {challenge ? (
          <form className="form-stack" onSubmit={handleVerify}>
            <label className="auth-field">
              <span>Verification code</span>
              <div className="input-shell">
                <ShieldCheck size={18} />
                <input
                  value={code}
                  onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                  autoComplete="one-time-code"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  placeholder="6-digit code"
                  required
                />
              </div>
            </label>
            <p className="auth-note">We sent a sign-in code to {challenge.email}.</p>
            {error ? <p className="form-error">{error}</p> : null}
            <button className="auth-submit" type="submit" disabled={loading || code.length !== 6}>
              {loading ? "Verifying..." : "Verify and sign in"}
              <ArrowRight size={18} />
            </button>
            <button className="auth-link-button" type="button" onClick={() => setChallenge(null)} disabled={loading}>
              Use a different account
            </button>
          </form>
        ) : (
          <form className="form-stack" onSubmit={handleSubmit}>
            <label className="auth-field">
              <span>Email or username</span>
              <div className="input-shell">
                <Mail size={18} />
                <input value={identifier} onChange={(event) => setIdentifier(event.target.value)} autoComplete="username" placeholder="admin@school.com" required />
              </div>
            </label>
            <label className="auth-field">
              <span>Password</span>
              <div className="input-shell">
                <LockKeyhole size={18} />
                <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" placeholder="Enter password" required />
              </div>
            </label>
            {error ? <p className="form-error">{error}</p> : null}
            <button className="auth-submit" type="submit" disabled={loading}>
              {loading ? "Signing in..." : "Sign in"}
              <ArrowRight size={18} />
            </button>
          </form>
        )}
      </section>
    </main>
  );
}
