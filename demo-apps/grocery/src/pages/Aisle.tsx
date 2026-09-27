import { useParams } from "react-router";
import { AISLES, CATALOG } from "../data/catalog.ts";
import ProductCard from "../components/ProductCard.tsx";

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

export default function Aisle() {
  const { slug } = useParams<{ slug: string }>();
  const aisle = AISLES.find((a) => slugify(a) === slug);
  const products = aisle ? CATALOG.filter((p) => p.aisle === aisle) : [];

  return (
    <div className="container" style={{ paddingTop: 24, paddingBottom: 60 }}>
      <h1>{aisle ?? "Aisle not found"}</h1>
      <div className="product-grid" style={{ marginTop: 18 }}>
        {products.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>
    </div>
  );
}
