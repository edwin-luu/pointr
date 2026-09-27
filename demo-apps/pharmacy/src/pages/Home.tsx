import { useEffect, useState } from "react";
import { notInDemo, rollPopup } from "@demo/shared";
import OrderReadyModal from "../components/OrderReadyModal.tsx";

export default function Home() {
  const [showOrderReady, setShowOrderReady] = useState(false);

  useEffect(() => {
    let active = true;
    rollPopup("pharmacy").then((should) => {
      if (active && should) setShowOrderReady(true);
    });
    return () => {
      active = false;
    };
  }, []);

  return (
    <>
      <div className="promo-strip">Free flu shots this week at all locations. No appointment needed.</div>
      <div className="container">
        <section className="hero">
          <div>
            <h1>Your neighborhood pharmacy</h1>
            <p>Prescriptions, vaccines, and everyday health products, all in one place.</p>
            <div style={{ display: "flex", gap: 10 }}>
              <button type="button" className="btn btn-primary" onClick={notInDemo}>
                Shop weekly deals
              </button>
              <button type="button" className="btn btn-ghost" onClick={notInDemo}>
                Find a store
              </button>
            </div>
          </div>
          <div className="hero-art" aria-hidden="true" />
        </section>

        <div className="grid-tiles">
          <div className="tile">
            <b>Vitamins</b>
            <p>Buy one, get one 50% off.</p>
          </div>
          <div className="tile">
            <b>Cold and flu</b>
            <p>Relief for the whole family.</p>
          </div>
          <div className="tile">
            <b>Photo prints</b>
            <p>Ready in one hour.</p>
          </div>
          <div className="tile">
            <b>Rewards</b>
            <p>Earn points on every purchase.</p>
          </div>
        </div>
      </div>

      {showOrderReady && <OrderReadyModal onClose={() => setShowOrderReady(false)} />}
    </>
  );
}
