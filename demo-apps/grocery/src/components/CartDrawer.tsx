import { useEffect } from "react";
import { useNavigate } from "react-router";
import { money } from "@demo/shared";
import { productById } from "../data/catalog.ts";
import { useGroceryStateCtx } from "../state/GroceryStateContext.tsx";

export default function CartDrawer({ onClose }: { onClose: () => void }) {
  const { state, setQty, removeFromCart, cartSubtotal } = useGroceryStateCtx();
  const navigate = useNavigate();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const subtotal = cartSubtotal();

  return (
    <>
      <div className="cart-drawer-backdrop" onClick={onClose} />
      <aside className="cart-drawer" aria-label="Cart">
        <div className="cart-drawer-head">
          <h2 style={{ margin: 0 }}>Your cart</h2>
          <button type="button" className="icon-btn" aria-label="Close cart" onClick={onClose}>
            <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
              <path d="M1 1 L13 13 M13 1 L1 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="cart-subtotal">
          <span>Subtotal</span>
          <span>{money(subtotal)}</span>
        </div>
        <button
          type="button"
          className="btn btn-primary btn-block"
          disabled={state.cart.length === 0}
          onClick={() => {
            onClose();
            navigate("/checkout");
          }}
        >
          Checkout
        </button>

        {state.cart.length === 0 ? (
          <p style={{ color: "var(--muted)" }}>Your cart is empty.</p>
        ) : (
          <div>
            {state.cart.map((line) => {
              const product = productById(line.productId);
              if (!product) return null;
              return (
                <div className="cart-line" key={line.productId}>
                  <span className="art" aria-hidden="true">
                    {product.emoji}
                  </span>
                  <div className="info">
                    <div className="name">{product.name}</div>
                    <div className="size">
                      {product.size} · {money(product.price)}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
                      <div className="qty-stepper" style={{ position: "static", background: "var(--panel)" }}>
                        <button
                          type="button"
                          aria-label={`Decrease quantity of ${product.name}`}
                          style={{ background: "var(--line)", color: "var(--ink)" }}
                          onClick={() => setQty(line.productId, line.qty - 1)}
                        >
                          −
                        </button>
                        <span style={{ color: "var(--ink)" }}>{line.qty}</span>
                        <button
                          type="button"
                          aria-label={`Increase quantity of ${product.name}`}
                          style={{ background: "var(--line)", color: "var(--ink)" }}
                          onClick={() => setQty(line.productId, line.qty + 1)}
                        >
                          +
                        </button>
                      </div>
                      <button type="button" className="remove" onClick={() => removeFromCart(line.productId)}>
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </aside>
    </>
  );
}
