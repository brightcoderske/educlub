"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, LockKeyhole, Mail, Sparkles } from "lucide-react";
import { login } from "../../lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const user = await login(identifier, password);
      if (user.role === "system_admin") router.push("/admin");
      else if (user.role === "school_admin") router.push("/school-admin");
      else router.push("/student");
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
      </section>
    </main>
  );
}
