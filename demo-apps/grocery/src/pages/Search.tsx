import { useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import { rollPopup } from "@demo/shared";
import { searchProducts } from "../data/catalog.ts";
import ProductCard from "../components/ProductCard.tsx";
import PromoPopup from "../components/PromoPopup.tsx";

export default function Search() {
  const [params] = useSearchParams();
  const q = params.get("q") ?? "";
  const results = searchProducts(q);
  const [showPromo, setShowPromo] = useState(false);

  useEffect(() => {
    setShowPromo(false);
    let active = true;
    const timer = setTimeout(() => {
      rollPopup("grocery").then((should) => {
        if (active && should) setShowPromo(true);
      });
    }, 3000);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [q]);

  return (
    <div className="container" style={{ paddingTop: 24, paddingBottom: 60 }}>
      <h1>
        {results.length} result{results.length === 1 ? "" : "s"} for &ldquo;{q}&rdquo;
      </h1>
      {results.length === 0 ? (
        <p style={{ color: "var(--muted)" }}>No products matched your search.</p>
      ) : (
        <div className="product-grid" style={{ marginTop: 18 }}>
          {results.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
      {showPromo && <PromoPopup onClose={() => setShowPromo(false)} />}
    </div>
  );
}
