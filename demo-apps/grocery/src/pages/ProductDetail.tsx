import { useParams } from "react-router";
import { money } from "@demo/shared";
import { productById } from "../data/catalog.ts";
import { useGroceryStateCtx } from "../state/GroceryStateContext.tsx";

export default function ProductDetail() {
  const { id } = useParams<{ id: string }>();
  const product = id ? productById(id) : undefined;
  const { state, addToCart, setQty } = useGroceryStateCtx();

  if (!product) {
    return (
      <div className="container" style={{ padding: "40px 24px" }}>
        <h1>Product not found</h1>
      </div>
    );
  }

  const line = state.cart.find((l) => l.productId === product.id);

  return (
    <div className="container" style={{ padding: "36px 24px 60px", display: "grid", gridTemplateColumns: "260px 1fr", gap: 32 }}>
      <div style={{ fontSize: "6rem", textAlign: "center", background: "var(--panel)", borderRadius: 20, padding: "40px 0" }} aria-hidden="true">
        {product.emoji}
      </div>
      <div>
        <h1>{product.name}</h1>
        <p style={{ color: "var(--muted)" }}>{product.size}</p>
        <p style={{ fontSize: "1.4rem", fontWeight: 700 }}>{money(product.price)}</p>
        <p style={{ color: "var(--muted)", maxWidth: "60ch" }}>
          A neighborhood favorite from the {product.aisle} aisle, picked fresh and stocked daily.
        </p>
        {line ? (
          <div className="qty-stepper" style={{ position: "static", display: "inline-flex" }}>
            <button type="button" aria-label={`Decrease quantity of ${product.name}`} onClick={() => setQty(product.id, line.qty - 1)}>
              −
            </button>
            <span>{line.qty}</span>
            <button type="button" aria-label={`Increase quantity of ${product.name}`} onClick={() => setQty(product.id, line.qty + 1)}>
              +
            </button>
          </div>
        ) : (
          <button type="button" className="btn btn-primary" onClick={() => addToCart(product.id, 1)}>
            Add to cart
          </button>
        )}
      </div>
    </div>
  );
}
