import { useState, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { notInDemo, useAuth } from "@demo/shared";

export default function SignIn() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (auth.login(username, password)) {
      setError("");
      navigate(params.get("next") || "/");
    } else {
      setError("Your username or password is incorrect.");
    }
  }

  return (
    <div className="container" style={{ maxWidth: 420, padding: "50px 24px 70px" }}>
      <div className="panel" style={{ maxWidth: "none" }}>
        <h1>Sign in</h1>
        <form onSubmit={onSubmit} noValidate>
          {error && <div style={{ background: "#fdeceb", border: "1px solid var(--red)", color: "var(--red)", borderRadius: 10, padding: "10px 12px", fontSize: "0.85rem", marginBottom: 14 }}>{error}</div>}
          <div className="field">
            <label htmlFor="username">Username</label>
            <input id="username" type="text" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <button type="submit" className="btn btn-primary btn-block">
            Sign in
          </button>
        </form>
        <button type="button" className="btn btn-outline btn-block" style={{ marginTop: 10 }} onClick={notInDemo}>
          Continue as guest
        </button>
      </div>
    </div>
  );
}
