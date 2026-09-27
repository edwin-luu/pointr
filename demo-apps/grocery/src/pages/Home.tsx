import { CATALOG } from "../data/catalog.ts";
import ProductCard from "../components/ProductCard.tsx";

function row(ids: string[]) {
  return ids.map((id) => CATALOG.find((p) => p.id === id)).filter((p): p is NonNullable<typeof p> => Boolean(p));
}

const FRESH_PICKS = row(["prod-bananas", "prod-tomatoes", "prod-avocados", "prod-carrots", "prod-peppers", "prod-lettuce"]);
const BREAKFAST = row(["dairy-whole-milk", "dairy-white-eggs-12", "bakery-white-bread", "bakery-bagels", "dairy-butter", "bev-coffee"]);
const DEALS = row(["bev-cola", "snack-chips", "frozen-icecream", "frozen-pizza", "bev-sparkling", "snack-nuts"]);

export default function Home() {
  return (
    <div className="container" style={{ paddingBottom: 60 }}>
      <section className="gc-hero">
        <h1>Groceries from your neighborhood store</h1>
        <p>Fresh produce, everyday essentials, and local favorites, delivered or ready for pickup.</p>
      </section>

      <div className="row-head">
        <h2>Fresh picks</h2>
      </div>
      <div className="product-row">
        {FRESH_PICKS.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>

      <div className="row-head">
        <h2>Breakfast basics</h2>
      </div>
      <div className="product-row">
        {BREAKFAST.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>

      <div className="row-head">
        <h2>Deals</h2>
      </div>
      <div className="product-row">
        {DEALS.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>
    </div>
  );
}
