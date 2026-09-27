import { DEMO_USER, showToast } from "@demo/shared";
import { useBankStateCtx } from "../state/BankStateContext.tsx";

export default function Profile() {
  const { state, setPaperless } = useBankStateCtx();

  return (
    <div className="container" style={{ padding: "34px 20px 60px" }}>
      <h1>Profile</h1>
      <div className="panel" style={{ marginBottom: 20 }}>
        <h2>Contact info</h2>
        <div className="field">
          <label>Name</label>
          <div>{DEMO_USER.name}</div>
        </div>
        <div className="field">
          <label>Email</label>
          <div>{DEMO_USER.email}</div>
        </div>
        <div className="field">
          <label>Phone</label>
          <div>{DEMO_USER.phone}</div>
        </div>
        <div className="field">
          <label>Address</label>
          <div>
            {DEMO_USER.address}, {DEMO_USER.city}, {DEMO_USER.state} {DEMO_USER.zip}
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="toggle-row" style={{ borderBottom: 0 }}>
          <div>
            <b>Paperless statements</b>
            <p style={{ margin: "2px 0 0", color: "#5b6b83", fontSize: "0.85rem" }}>Get statements by email instead of mail.</p>
          </div>
          <label className="switch">
            <input
              type="checkbox"
              checked={state.paperless}
              onChange={(e) => {
                setPaperless(e.target.checked);
                showToast(e.target.checked ? "You're now paperless." : "Paperless statements turned off.");
              }}
              aria-label="Paperless statements"
            />
            <span className="track" aria-hidden="true" />
          </label>
        </div>
      </div>
    </div>
  );
}
