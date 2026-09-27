import { Link, useParams } from "react-router";
import { money } from "@demo/shared";
import { useGroceryStateCtx } from "../state/GroceryStateContext.tsx";

export default function OrderConfirm() {
  const { id } = useParams<{ id: string }>();
  const { state } = useGroceryStateCtx();
  const order = state.orders.find((o) => o.id === id);

  if (!order) {
    return (
      <div className="container" style={{ padding: "36px 24px" }}>
        <h1>Order not found</h1>
        <Link to="/" className="btn btn-primary">
          Back to home
        </Link>
      </div>
    );
  }

  return (
    <div className="container" style={{ padding: "34px 24px 60px" }}>
      <div className="panel confirm-box">
        <div className="confirm-check" aria-hidden="true">
          ✓
        </div>
        <h2>Order placed</h2>
        <p>
          Order <b>{order.id}</b>
        </p>
        <p>
          {order.fulfillment === "Pickup" ? `Pickup at ${order.store}` : "Delivery to 742 Palm Ave, Apt 3"} - {order.window}
        </p>
        <div className="summary-box" style={{ textAlign: "left" }}>
          {order.lines.map((l) => (
            <div className="summary-row" key={l.name}>
              <span>
                {l.name} × {l.qty}
              </span>
              <span>{money(l.price * l.qty)}</span>
            </div>
          ))}
          <div className="summary-row total">
            <span>Total</span>
            <span>{money(order.total)}</span>
          </div>
        </div>
        <Link to="/" className="btn btn-primary">
          Back to home
        </Link>
      </div>
    </div>
  );
}
