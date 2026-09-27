import { money } from "@demo/shared";
import { useGroceryStateCtx } from "../state/GroceryStateContext.tsx";

export default function Orders() {
  const { state } = useGroceryStateCtx();

  return (
    <div className="container" style={{ padding: "34px 24px 60px" }}>
      <h1>Your orders</h1>
      {state.orders.length === 0 ? (
        <p style={{ color: "var(--muted)" }}>You haven't placed any orders yet.</p>
      ) : (
        <ul className="order-list">
          {state.orders.map((o) => (
            <li key={o.id}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <b>{o.id}</b>
                <span>{money(o.total)}</span>
              </div>
              <div style={{ color: "var(--muted)", fontSize: "0.85rem" }}>
                {o.fulfillment} · {o.window} · {o.date}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
