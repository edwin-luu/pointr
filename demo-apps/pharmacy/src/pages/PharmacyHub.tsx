import { useState } from "react";
import { Link } from "react-router";
import { notInDemo } from "@demo/shared";

export default function PharmacyHub() {
  const [showPharmacist, setShowPharmacist] = useState(false);

  return (
    <div className="container" style={{ padding: "30px 22px 60px" }}>
      <h1>Pharmacy</h1>
      <p style={{ color: "var(--muted)" }}>Manage prescriptions for you and your family.</p>

      <div className="card-grid">
        <Link to="/pharmacy/refills" className="action-card">
          <span className="action-ico" aria-hidden="true">
            Rx
          </span>
          <b>Refill a prescription</b>
          <small>Reorder medicine you already take</small>
        </Link>
        <button type="button" className="action-card" onClick={notInDemo}>
          <span className="action-ico" aria-hidden="true">
            ⇄
          </span>
          <b>Transfer a prescription</b>
          <small>Move a prescription from another pharmacy</small>
        </button>
        <button type="button" className="action-card" onClick={() => setShowPharmacist((v) => !v)}>
          <span className="action-ico" aria-hidden="true">
            ?
          </span>
          <b>Talk to a pharmacist</b>
          <small>{showPharmacist ? "Call (305) 555-0110 - available 24 hours a day" : "Chat or call, 24 hours a day"}</small>
        </button>
        <Link to="/pharmacy/orders" className="action-card">
          <span className="action-ico" aria-hidden="true">
            ✓
          </span>
          <b>Order history</b>
          <small>Track your recent pickups</small>
        </Link>
        <button type="button" className="action-card" onClick={notInDemo}>
          <span className="action-ico" aria-hidden="true">
            +
          </span>
          <b>Vaccines</b>
          <small>Schedule a shot</small>
        </button>
      </div>
    </div>
  );
}
