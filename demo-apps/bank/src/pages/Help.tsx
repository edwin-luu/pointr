import { useState } from "react";
import { Link } from "react-router";
import { useAuth } from "@demo/shared";

const FAQS = [
  { q: "How do I reset my password?", a: "Go to the sign-in box and choose “Forgot username or password?” to start a reset." },
  { q: "How do I pay my credit card bill?", a: "Sign in, open your card account, and choose Pay card. You can pay the statement balance, minimum due, current balance, or another amount." },
  { q: "How do I set up direct deposit?", a: "Give your employer your Everyday Checking account and routing number, found on your checks or in Account details." },
  { q: "What are your daily transfer limits?", a: "Transfers between your own Harbor Bank accounts have no daily limit. External transfers are limited to $5,000 per day." },
  { q: "How do I turn on paperless statements?", a: "Sign in, open your Profile page, and switch on Paperless statements." },
  { q: "How do I report a lost or stolen card?", a: "Call us right away at 1-800-555-0142, available any time." },
  { q: "How do I dispute a transaction?", a: "Send us a secure message with the transaction date and amount, and we'll open a dispute within one business day." },
  { q: "Where can I find a branch?", a: "See “Find a branch” below for our three Miami locations and hours." },
];

const BRANCHES = [
  { name: "Downtown Miami", address: "120 Biscayne Blvd, Miami, FL 33132", hours: "Mon-Fri 9am-5pm, Sat 9am-1pm" },
  { name: "Coral Way", address: "2200 SW 22nd St, Miami, FL 33145", hours: "Mon-Fri 9am-5pm" },
  { name: "Flagler Street", address: "980 W Flagler St, Miami, FL 33130", hours: "Mon-Fri 9am-6pm, Sat 9am-1pm" },
];

export default function Help() {
  const auth = useAuth();
  const [query, setQuery] = useState("");
  const filtered = FAQS.filter((f) => f.q.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="container" style={{ padding: "34px 20px 60px" }}>
      <h1>Help center</h1>

      <div className="field" style={{ maxWidth: 420 }}>
        <label htmlFor="faq-search">Search help topics</label>
        <input id="faq-search" type="text" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="e.g. paperless statements" />
      </div>

      <section className="section" style={{ paddingTop: 8 }}>
        {filtered.map((f) => (
          <details className="faq-item" key={f.q}>
            <summary>{f.q}</summary>
            <p>{f.a}</p>
          </details>
        ))}
        {filtered.length === 0 && <p style={{ color: "#5b6b83" }}>No help topics match your search.</p>}
      </section>

      <section className="section">
        <h2>Contact us</h2>
        <p>
          Call <b>1-800-555-0142</b>
          <br />
          Mon-Fri 8am-8pm, Sat 9am-2pm
        </p>
        {auth.loggedIn ? (
          <Link to="/messages/new" className="btn btn-navy">
            Send a secure message
          </Link>
        ) : (
          <Link to="/login?next=/messages/new" className="btn btn-navy">
            Send a secure message
          </Link>
        )}
      </section>

      <section className="section">
        <h2>Find a branch</h2>
        <div className="tile-grid" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
          {BRANCHES.map((b) => (
            <div className="tile" key={b.name}>
              <b>{b.name}</b>
              <p>{b.address}</p>
              <p>{b.hours}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
