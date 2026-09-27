import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import SignInForm from "../components/SignInForm.tsx";
import { money, notInDemo, useAuth } from "@demo/shared";
import { useBankStateCtx } from "../state/BankStateContext.tsx";

const SLIDES = [
  { title: "0% intro APR on balance transfers", body: "Move a balance to a Harbor Rewards Visa and pay 0% for 15 months." },
  { title: "Earn 4.10% APY on Harbor Savings", body: "No minimum balance, no monthly fee, FDIC insured." },
  { title: "Refer a friend, get $75", body: "When they open a checking account and set up direct deposit." },
];

const TILES = [
  { title: "Everyday Checking", body: "No monthly fee with direct deposit." },
  { title: "Harbor Savings", body: "4.10% APY, no minimum balance." },
  { title: "Harbor Rewards Visa", body: "3% cash back on groceries and gas." },
  { title: "Home loans", body: "Fixed and adjustable rate mortgages." },
];

const RATES = [
  { product: "Harbor Savings", rate: "4.10% APY", min: "$0 minimum" },
  { product: "12-month CD", rate: "4.55% APY", min: "$500 minimum" },
  { product: "Harbor Rewards Visa", rate: "18.99% - 27.99% variable APR", min: "No annual fee" },
  { product: "30-year fixed mortgage", rate: "6.35% APR", min: "As low as 5% down" },
];

export default function Home() {
  const auth = useAuth();
  const { state } = useBankStateCtx();
  const [slide, setSlide] = useState(0);
  const [paused, setPaused] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (paused) return;
    timer.current = setInterval(() => setSlide((s) => (s + 1) % SLIDES.length), 6000);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [paused]);

  return (
    <>
      <section className="hero">
        <div className="container">
          <div>
            <h1>Banking that works as hard as you do.</h1>
            <p className="lead">
              Checking, savings, credit cards and loans, with real people at over 90 branches across
              Florida.
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <button type="button" className="btn btn-gold" onClick={notInDemo}>
                Open an account
              </button>
              <button type="button" className="btn btn-outline" style={{ background: "transparent", color: "#fff", borderColor: "#fff" }} onClick={notInDemo}>
                See all rates
              </button>
            </div>
          </div>
          {auth.loggedIn ? (
            <div className="signin-card">
              <h2>Welcome back, {auth.name.split(" ")[0]}</h2>
              <p style={{ color: "var(--muted)", marginTop: -6 }}>
                Everyday Checking ••4821: <b>{money(state.checking)}</b>
              </p>
              <Link to="/accounts" className="btn btn-gold btn-block">
                Go to your accounts
              </Link>
            </div>
          ) : (
            <SignInForm />
          )}
        </div>
      </section>

      <div className="container">
        <div className="carousel" role="region" aria-label="Promotions">
          <div className="carousel-track" style={{ transform: `translateX(-${slide * 100}%)` }}>
            {SLIDES.map((s) => (
              <div className="carousel-slide" key={s.title}>
                <div>
                  <h3>{s.title}</h3>
                  <p>{s.body}</p>
                </div>
                <button type="button" className="btn btn-navy btn-sm" onClick={notInDemo}>
                  Learn more
                </button>
              </div>
            ))}
          </div>
          <div className="carousel-controls">
            <button type="button" aria-label={paused ? "Resume promotions" : "Pause promotions"} onClick={() => setPaused((p) => !p)}>
              {paused ? "▶" : "⏸"}
            </button>
          </div>
        </div>

        <section className="section">
          <h2>Popular products</h2>
          <div className="tile-grid">
            {TILES.map((t) => (
              <div className="tile" key={t.title}>
                <b>{t.title}</b>
                <p>{t.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="section">
          <h2>Today's rates</h2>
          <table className="rates-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Rate</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {RATES.map((r) => (
                <tr key={r.product}>
                  <td>{r.product}</td>
                  <td>{r.rate}</td>
                  <td>{r.min}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="section">
          <h2>Why Harbor Bank</h2>
          <div className="why-grid">
            <div className="tile">
              <b>90+ branches</b>
              <p>Real people across Florida, open six days a week.</p>
            </div>
            <div className="tile">
              <b>24/7 support</b>
              <p>Phone and secure messaging whenever you need it.</p>
            </div>
            <div className="tile">
              <b>Member FDIC</b>
              <p>Your deposits are insured up to the maximum allowed by law.</p>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
