import { useState } from "react";
import { Navigate, useNavigate } from "react-router";
import { DEMO_USER, money, notInDemo, useAuth } from "@demo/shared";
import { STORES, productById } from "../data/catalog.ts";
import { useGroceryStateCtx } from "../state/GroceryStateContext.tsx";

const DELIVERY_WINDOWS = ["Today 4-5 PM", "Today 5-6 PM", "Today 6-7 PM", "Tomorrow 9-10 AM", "Tomorrow 10-11 AM"];
const PICKUP_WINDOWS = ["Today 3-4 PM", "Today 4-5 PM", "Today 5-6 PM", "Tomorrow 10-11 AM"];
const TIP_OPTIONS = [10, 15, 20];

export default function Checkout() {
  const auth = useAuth();
  const navigate = useNavigate();
  const { state, cartSubtotal, placeOrder } = useGroceryStateCtx();
  const [step, setStep] = useState(1);
  const [fulfillment, setFulfillment] = useState<"Delivery" | "Pickup">("Delivery");
  const [windowChoice, setWindowChoice] = useState("");
  const [tipPct, setTipPct] = useState<number | "custom">(15);
  const [customTip, setCustomTip] = useState("");

  if (!auth.loggedIn) return <Navigate to="/signin?next=/checkout" replace />;
  if (state.cart.length === 0 && step < 4) {
    return (
      <div className="container" style={{ padding: "36px 24px" }}>
        <h1>Your cart is empty</h1>
        <p style={{ color: "var(--muted)" }}>Add items to your cart before checking out.</p>
      </div>
    );
  }

  const store = STORES.find((s) => s.id === state.storeId) ?? STORES[0];
  const subtotal = cartSubtotal();
  const deliveryFee = fulfillment === "Delivery" ? 3.99 : 0;
  const serviceFee = fulfillment === "Delivery" ? 2.49 : 0;
  const tax = Math.round(subtotal * 0.07 * 100) / 100;
  const tipAmount = fulfillment === "Delivery" ? (tipPct === "custom" ? Number(customTip) || 0 : Math.round(subtotal * (tipPct / 100) * 100) / 100) : 0;
  const total = Math.round((subtotal + deliveryFee + serviceFee + tax + tipAmount) * 100) / 100;

  function onPlaceOrder() {
    const order = placeOrder({ fulfillment, window: windowChoice, storeName: store.name });
    navigate(`/orders/${order.id}`, { replace: true });
  }

  return (
    <div className="container" style={{ padding: "34px 24px 60px" }}>
      <h1>Checkout</h1>
      <div className="stepper-head">
        <div className={`step ${step === 1 ? "active" : "done"}`}>1. Delivery or pickup</div>
        <div className={`step ${step === 2 ? "active" : step > 2 ? "done" : ""}`}>2. Window</div>
        <div className={`step ${step === 3 ? "active" : step > 3 ? "done" : ""}`}>3. Payment</div>
        <div className={`step ${step === 4 ? "active" : ""}`}>4. Review</div>
      </div>

      {step === 1 && (
        <div className="panel">
          <h2>How do you want your order?</h2>
          <div className="segmented" role="group" aria-label="Fulfillment method">
            <button type="button" aria-pressed={fulfillment === "Delivery"} onClick={() => setFulfillment("Delivery")}>
              Delivery
            </button>
            <button type="button" aria-pressed={fulfillment === "Pickup"} onClick={() => setFulfillment("Pickup")}>
              Pickup
            </button>
          </div>
          <button type="button" className="btn btn-primary" onClick={() => setStep(2)}>
            Continue
          </button>
        </div>
      )}

      {step === 2 && fulfillment === "Delivery" && (
        <div className="panel">
          <h2>Delivery details</h2>
          <div className="field">
            <label>Delivery address</label>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>{DEMO_USER.address}, {DEMO_USER.city}, {DEMO_USER.state} {DEMO_USER.zip}</span>
              <button type="button" className="linkbtn" onClick={notInDemo} style={{ background: "none", border: 0, color: "var(--green-2)", textDecoration: "underline", cursor: "pointer" }}>
                Change
              </button>
            </div>
          </div>
          <div className="field">
            <label>Delivery window</label>
          </div>
          <div className="window-grid">
            {DELIVERY_WINDOWS.map((w) => (
              <button key={w} type="button" className={`window-btn ${windowChoice === w ? "selected" : ""}`} onClick={() => setWindowChoice(w)}>
                {w}
              </button>
            ))}
          </div>
          <div className="field">
            <label>Driver tip</label>
          </div>
          <div className="tip-grid">
            {TIP_OPTIONS.map((t) => (
              <button key={t} type="button" className={`tip-btn ${tipPct === t ? "selected" : ""}`} onClick={() => setTipPct(t)}>
                {t}%
              </button>
            ))}
            <button type="button" className={`tip-btn ${tipPct === "custom" ? "selected" : ""}`} onClick={() => setTipPct("custom")}>
              Custom
            </button>
          </div>
          {tipPct === "custom" && (
            <div className="field" style={{ maxWidth: 160 }}>
              <label htmlFor="custom-tip">Custom tip amount</label>
              <input id="custom-tip" type="number" min="0" step="0.5" value={customTip} onChange={(e) => setCustomTip(e.target.value)} />
            </div>
          )}
          <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
            <button type="button" className="btn btn-outline" onClick={() => setStep(1)}>
              Back
            </button>
            <button type="button" className="btn btn-primary" disabled={!windowChoice} onClick={() => setStep(3)}>
              Continue
            </button>
          </div>
        </div>
      )}

      {step === 2 && fulfillment === "Pickup" && (
        <div className="panel">
          <h2>Pickup details</h2>
          <div className="field">
            <label>Pickup store</label>
            <div>
              {store.name} - {store.area}
            </div>
          </div>
          <div className="field">
            <label>Pickup window</label>
          </div>
          <div className="window-grid">
            {PICKUP_WINDOWS.map((w) => (
              <button key={w} type="button" className={`window-btn ${windowChoice === w ? "selected" : ""}`} onClick={() => setWindowChoice(w)}>
                {w}
              </button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
            <button type="button" className="btn btn-outline" onClick={() => setStep(1)}>
              Back
            </button>
            <button type="button" className="btn btn-primary" disabled={!windowChoice} onClick={() => setStep(3)}>
              Continue
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="panel">
          <h2>Payment</h2>
          <div className="window-btn selected" style={{ display: "block", marginBottom: 14 }}>
            Visa ending 1956
          </div>
          <button type="button" className="linkbtn" onClick={notInDemo} style={{ background: "none", border: 0, color: "var(--green-2)", textDecoration: "underline", cursor: "pointer", display: "block", marginBottom: 14 }}>
            Add a card
          </button>
          <div style={{ display: "flex", gap: 10 }}>
            <button type="button" className="btn btn-outline" onClick={() => setStep(2)}>
              Back
            </button>
            <button type="button" className="btn btn-primary" onClick={() => setStep(4)}>
              Continue
            </button>
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="panel">
          <h2>Review your order</h2>
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {state.cart.map((line) => {
              const product = productById(line.productId);
              if (!product) return null;
              return (
                <li key={line.productId} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}>
                  <span>
                    {product.name} × {line.qty}
                  </span>
                  <span>{money(product.price * line.qty)}</span>
                </li>
              );
            })}
          </ul>
          <div className="summary-box">
            <div className="summary-row">
              <span>Subtotal</span>
              <span>{money(subtotal)}</span>
            </div>
            {fulfillment === "Delivery" && (
              <>
                <div className="summary-row">
                  <span>Delivery fee</span>
                  <span>{money(deliveryFee)}</span>
                </div>
                <div className="summary-row">
                  <span>Service fee</span>
                  <span>{money(serviceFee)}</span>
                </div>
                <div className="summary-row">
                  <span>Driver tip</span>
                  <span>{money(tipAmount)}</span>
                </div>
              </>
            )}
            <div className="summary-row">
              <span>Tax</span>
              <span>{money(tax)}</span>
            </div>
            <div className="summary-row total">
              <span>Total</span>
              <span>{money(total)}</span>
            </div>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button type="button" className="btn btn-outline" onClick={() => setStep(3)}>
              Back
            </button>
            <button type="button" className="btn btn-primary" onClick={onPlaceOrder}>
              Place order
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
