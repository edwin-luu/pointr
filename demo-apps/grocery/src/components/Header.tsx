import { useRef, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { useAuth } from "@demo/shared";
import { STORES } from "../data/catalog.ts";
import { useGroceryStateCtx } from "../state/GroceryStateContext.tsx";
import SideMenu from "./SideMenu.tsx";
import CartDrawer from "./CartDrawer.tsx";
import StorePickerModal from "./StorePickerModal.tsx";

export default function Header() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { state } = useGroceryStateCtx();
  const [menuOpen, setMenuOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [storeOpen, setStoreOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [query, setQuery] = useState(params.get("q") ?? "");
  const searchInputRef = useRef<HTMLInputElement>(null);

  const store = STORES.find((s) => s.id === state.storeId) ?? STORES[0];
  const cartCount = state.cart.reduce((sum, l) => sum + l.qty, 0);

  function onSearch(e: FormEvent) {
    e.preventDefault();
    if (query.trim()) navigate(`/search?q=${encodeURIComponent(query.trim())}`);
    searchInputRef.current?.blur();
  }

  return (
    <>
      <header className="gc-header">
        <div className="bar">
          <button type="button" className="icon-btn" aria-label="Open menu" onClick={() => setMenuOpen(true)}>
            <svg width="20" height="16" viewBox="0 0 20 16" aria-hidden="true">
              <path d="M0 1h20M0 8h20M0 15h20" stroke="currentColor" strokeWidth="2" />
            </svg>
          </button>
          <Link to="/" className="gc-logo">
            FreshCart
          </Link>
          <button type="button" className="store-pill" onClick={() => setStoreOpen(true)}>
            Shopping at <b>{store.name}</b> - {store.area}
          </button>
          <form className="search-wrap" onSubmit={onSearch} role="search">
            <label htmlFor="gc-search" className="sr-only" style={{ position: "absolute", width: 1, height: 1, overflow: "hidden" }}>
              Search products
            </label>
            <input
              id="gc-search"
              ref={searchInputRef}
              type="text"
              placeholder="Search products"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </form>
          <div style={{ position: "relative" }}>
            <button
              type="button"
              className="icon-btn"
              aria-label="Account"
              aria-haspopup="true"
              aria-expanded={accountOpen}
              onClick={() => setAccountOpen((v) => !v)}
            >
              <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
                <circle cx="10" cy="6" r="4" fill="currentColor" />
                <path d="M2 19c0-4.5 3.5-7 8-7s8 2.5 8 7" fill="currentColor" />
              </svg>
            </button>
            {accountOpen && (
              <ul className="account-menu-list" style={{ position: "absolute", right: 0, top: "calc(100% + 6px)", background: "#fff", borderRadius: 12, boxShadow: "0 12px 28px rgba(0,0,0,.15)", listStyle: "none", margin: 0, padding: 6, minWidth: 180, zIndex: 60 }} onMouseLeave={() => setAccountOpen(false)}>
                <li style={{ padding: "8px 10px", color: "var(--muted)", fontSize: "0.82rem" }}>
                  {auth.loggedIn ? `Signed in as ${auth.name.split(" ")[0]}` : "Signed out"}
                </li>
                <li>
                  <Link to="/orders" onClick={() => setAccountOpen(false)} style={{ display: "block", padding: "9px 10px", borderRadius: 8, textDecoration: "none", color: "inherit" }}>
                    Orders
                  </Link>
                </li>
                {auth.loggedIn ? (
                  <li>
                    <button
                      type="button"
                      style={{ display: "block", width: "100%", textAlign: "left", padding: "9px 10px", borderRadius: 8, background: "none", border: 0, cursor: "pointer" }}
                      onClick={() => {
                        setAccountOpen(false);
                        auth.logout();
                        navigate("/");
                      }}
                    >
                      Sign out
                    </button>
                  </li>
                ) : (
                  <li>
                    <Link to="/signin" onClick={() => setAccountOpen(false)} style={{ display: "block", padding: "9px 10px", borderRadius: 8, textDecoration: "none", color: "inherit" }}>
                      Sign in
                    </Link>
                  </li>
                )}
              </ul>
            )}
          </div>
          <button type="button" className="icon-btn" aria-label={`Cart, ${cartCount} items`} onClick={() => setCartOpen(true)}>
            <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
              <path d="M2 3h2l1.6 10.4A2 2 0 0 0 7.6 15h7.8a2 2 0 0 0 2-1.6L19 6H5" stroke="currentColor" strokeWidth="1.7" fill="none" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="8" cy="18" r="1.3" fill="currentColor" />
              <circle cx="15" cy="18" r="1.3" fill="currentColor" />
            </svg>
            {cartCount > 0 && <span className="cart-badge">{cartCount}</span>}
          </button>
        </div>
      </header>

      {menuOpen && <SideMenu onClose={() => setMenuOpen(false)} />}
      {cartOpen && <CartDrawer onClose={() => setCartOpen(false)} />}
      {storeOpen && <StorePickerModal onClose={() => setStoreOpen(false)} />}
    </>
  );
}
