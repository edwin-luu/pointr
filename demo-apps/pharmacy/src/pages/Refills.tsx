import { useState } from "react";
import { useNavigate } from "react-router";
import { usePharmacyStateCtx } from "../state/PharmacyStateContext.tsx";
import { requestRenewalCopy } from "../data/copy.ts";

export default function Refills() {
  const { state, requestRenewal } = usePharmacyStateCtx();
  const navigate = useNavigate();
  const [selected, setSelected] = useState<string[]>([]);

  function toggle(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  return (
    <div className="container" style={{ padding: "30px 22px 60px" }}>
      <h1>Your prescriptions</h1>
      <p style={{ color: "var(--muted)" }}>Signed in as Edwin. Choose what you want to refill.</p>

      <ul className="rx-list">
        {state.prescriptions.map((rx) => {
          const disabled = rx.status !== "refillable";
          return (
            <li key={rx.id}>
              <input
                type="checkbox"
                checked={selected.includes(rx.id)}
                disabled={disabled}
                onChange={() => toggle(rx.id)}
                aria-label={`Select ${rx.name} for refill`}
              />
              <div className="rx-body">
                <div className="rx-name">{rx.name}</div>
                <div className="rx-sub">
                  For {rx.purpose} · {rx.refillsLeft} refill{rx.refillsLeft === 1 ? "" : "s"} left
                  {rx.lastFilled ? ` · Last filled ${rx.lastFilled}` : ""}
                </div>
                {rx.status === "no-refills" && (
                  <button type="button" className="btn btn-ghost btn-sm" style={{ marginTop: 8 }} onClick={() => requestRenewal(rx.id)}>
                    Request renewal from Dr. Alvarez
                  </button>
                )}
                {rx.status === "renewal-requested" && <div className="rx-note">{requestRenewalCopy}</div>}
                {rx.status === "too-early" && (
                  <div className="rx-note">Too early to refill. Available {rx.availableDate}.</div>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <button
        type="button"
        className="btn btn-primary"
        disabled={selected.length === 0}
        onClick={() => navigate("/pharmacy/refills/review", { state: { rxIds: selected } })}
      >
        Continue
      </button>
    </div>
  );
}
