import { useEffect } from "react";
import { Link } from "react-router";
import { notInDemo } from "@demo/shared";
import { AISLES } from "../data/catalog.ts";

export default function SideMenu({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <>
      <div className="side-menu-backdrop" onClick={onClose} />
      <nav className="side-menu" aria-label="Site menu">
        <button type="button" className="icon-btn" aria-label="Close menu" onClick={onClose} style={{ alignSelf: "flex-end" }}>
          <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
            <path d="M1 1 L13 13 M13 1 L1 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
        <h2>Aisles</h2>
        {AISLES.map((a) => (
          <Link key={a} to={`/aisle/${encodeURIComponent(a.toLowerCase().replace(/[^a-z0-9]+/g, "-"))}`} onClick={onClose}>
            {a}
          </Link>
        ))}
        <h2>Account</h2>
        <Link to="/orders" onClick={onClose}>
          Orders
        </Link>
        <button type="button" className="linklike" onClick={notInDemo}>
          Help
        </button>
      </nav>
    </>
  );
}
