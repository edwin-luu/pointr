import { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router";
import { usePharmacyStateCtx } from "../state/PharmacyStateContext.tsx";

const STORES = ["SunPlaza, W Flagler St", "SunPlaza, Coral Way", "SunPlaza, Bird Road"];
const TIMES = ["Tomorrow after 2 PM", "Tomorrow after 5 PM", "Monday after 10 AM"];

export default function RefillsReview() {
  const location = useLocation() as { state?: { rxIds?: string[] } };
  const navigate = useNavigate();
  const { state, placeRefillOrder } = usePharmacyStateCtx();
  const [store, setStore] = useState(STORES[0]);
  const [time, setTime] = useState(TIMES[0]);

  const rxIds = location.state?.rxIds ?? [];
  if (rxIds.length === 0) return <Navigate to="/pharmacy/refills" replace />;

  const items = state.prescriptions.filter((r) => rxIds.includes(r.id));

  function onPlaceOrder() {
    const orderId = placeRefillOrder(rxIds, store, time);
    navigate("/pharmacy/refills/done", { state: { orderId, store, time, items: items.map((i) => i.name) } });
  }

  return (
    <div className="container" style={{ padding: "30px 22px 60px" }}>
      <h1>Review your refill</h1>
      <p style={{ color: "var(--muted)" }}>Check the details, then place your order.</p>

      <div className="summary-box" style={{ maxWidth: 460 }}>
        {items.map((i) => (
          <div className="summary-row" key={i.id}>
            <span>{i.name}</span>
            <span>30 tablets</span>
          </div>
        ))}
      </div>

      <div className="field" style={{ maxWidth: 360 }}>
        <label htmlFor="pickup-store">Pickup store</label>
        <select id="pickup-store" value={store} onChange={(e) => setStore(e.target.value)}>
          {STORES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>
      <div className="field" style={{ maxWidth: 360 }}>
        <label htmlFor="pickup-time">Pickup time</label>
        <select id="pickup-time" value={time} onChange={(e) => setTime(e.target.value)}>
          {TIMES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>

      <div style={{ display: "flex", gap: 10 }}>
        <button type="button" className="btn btn-ghost" onClick={() => navigate("/pharmacy/refills")}>
          Back
        </button>
        <button type="button" className="btn btn-primary" onClick={onPlaceOrder}>
          Place refill order
        </button>
      </div>
    </div>
  );
}
