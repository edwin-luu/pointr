import { useState, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { notInDemo, rollPopup, useAuth } from "@demo/shared";
import { POPUP_FLAG } from "../App.tsx";

export default function SignInForm({ heading = true }: { heading?: boolean }) {
  const auth = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (auth.login(username, password)) {
      setError("");
      const shouldPopup = await rollPopup("bank");
      if (shouldPopup) sessionStorage.setItem(POPUP_FLAG, "1");
      navigate(params.get("next") || "/accounts");
    } else {
      setError("Your username or password is incorrect.");
    }
  }

  return (
    <div className="signin-card">
      {heading && <h2>Sign in</h2>}
      <form onSubmit={onSubmit} noValidate>
        {error && <div className="form-error-banner">{error}</div>}
        <div className="field">
          <label htmlFor="si-username">Username</label>
          <input
            id="si-username"
            type="text"
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="si-password">Password</label>
          <input
            id="si-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <div className="field-row-check">
          <input
            id="si-remember"
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
          />
          <label htmlFor="si-remember">Remember me</label>
        </div>
        <button type="submit" className="btn btn-gold btn-block">
          Sign in
        </button>
      </form>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12 }}>
        <button type="button" className="linkbtn" onClick={notInDemo}>
          Forgot username or password?
        </button>
        <button type="button" className="linkbtn" onClick={notInDemo}>
          Enroll
        </button>
      </div>
    </div>
  );
}
