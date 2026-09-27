import { Link } from "react-router";
import { money } from "@demo/shared";
import type { Product } from "../data/types.ts";
import { useGroceryStateCtx } from "../state/GroceryStateContext.tsx";

export default function ProductCard({ product }: { product: Product }) {
  const { state, addToCart, setQty } = useGroceryStateCtx();
  const line = state.cart.find((l) => l.productId === product.id);

  return (
    <div className="product-card">
      <Link to={`/product/${product.id}`} style={{ textDecoration: "none", color: "inherit" }}>
        <div className="art" aria-hidden="true">
          {product.emoji}
        </div>
        <div className="name">{product.name}</div>
        <div className="size">{product.size}</div>
        <div className="price">{money(product.price)}</div>
      </Link>
      {line ? (
        <div className="qty-stepper">
          <button type="button" aria-label={`Decrease quantity of ${product.name}`} onClick={() => setQty(product.id, line.qty - 1)}>
            −
          </button>
          <span>{line.qty}</span>
          <button type="button" aria-label={`Increase quantity of ${product.name}`} onClick={() => setQty(product.id, line.qty + 1)}>
            +
          </button>
        </div>
      ) : (
        <button type="button" className="add-btn" aria-label={`Add ${product.name} to cart`} onClick={() => addToCart(product.id, 1)}>
          +
        </button>
      )}
    </div>
  );
}
