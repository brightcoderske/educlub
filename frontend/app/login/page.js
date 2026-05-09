"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
        <div>
          <p className="eyebrow">Welcome back</p>
          <h2>Sign in to continue</h2>
        </div>
        <form className="form-stack" onSubmit={handleSubmit}>
          <label>
            Email or username
            <input value={identifier} onChange={(event) => setIdentifier(event.target.value)} autoComplete="username" required />
          </label>
          <label>
            Password
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required />
          </label>
          {error ? <p className="form-error">{error}</p> : null}
          <button type="submit" disabled={loading}>{loading ? "Signing in..." : "Sign in"}</button>
        </form>
      </section>
    </main>
  );
}
