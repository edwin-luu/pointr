import { Link, Navigate, useLocation } from "react-router";

type DoneState = { orderId: string; store: string; time: string; items: string[] };

export default function RefillsDone() {
  const location = useLocation() as { state?: DoneState };
  const s = location.state;
  if (!s) return <Navigate to="/pharmacy" replace />;

  return (
    <div className="container" style={{ padding: "30px 22px 60px" }}>
      <div className="panel confirm-box">
        <div className="confirm-check" aria-hidden="true">
          ✓
        </div>
        <h2>Refill ordered</h2>
        <p>
          Order <b>{s.orderId}</b> for {s.items.join(", ")}.
        </p>
        <p>
          Pickup at {s.store}, {s.time}. We'll text you when it's ready.
        </p>
        <Link to="/" className="btn btn-primary">
          Back to home
        </Link>
      </div>
    </div>
  );
}
