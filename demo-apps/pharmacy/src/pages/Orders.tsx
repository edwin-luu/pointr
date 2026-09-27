import { usePharmacyStateCtx } from "../state/PharmacyStateContext.tsx";

export default function Orders() {
  const { state } = usePharmacyStateCtx();

  return (
    <div className="container" style={{ padding: "30px 22px 60px" }}>
      <h1>Order history</h1>
      <ul className="order-list">
        {state.orders.map((o) => (
          <li key={o.id}>
            <div>
              <b>
                #{o.id} - {o.item}
              </b>
              <div style={{ color: "var(--muted)", fontSize: "0.85rem" }}>
                {o.date}
                {o.pickupDetails ? ` · ${o.pickupDetails}` : ""}
              </div>
            </div>
            <span className={`badge ${o.status === "Picked up" ? "" : ""}`}>{o.status}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
