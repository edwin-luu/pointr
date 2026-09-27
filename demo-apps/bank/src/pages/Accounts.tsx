import { Link } from "react-router";
import { money, notInDemo } from "@demo/shared";
import { useBankStateCtx } from "../state/BankStateContext.tsx";

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export default function Accounts() {
  const { state } = useBankStateCtx();
  const recent = [...state.transactions]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 8);

  return (
    <>
      <div className="page-head">
        <div className="container">
          <h1>{greeting()}, Edwin</h1>
        </div>
      </div>

      <div className="container" style={{ paddingTop: 24, paddingBottom: 40 }}>
        <div className="account-grid">
          <Link to="/accounts/checking" className="account-card">
            <span className="label">Everyday Checking ••4821</span>
            <span className="balance">{money(state.checking)}</span>
            <span className="sub">Available balance</span>
          </Link>
          <Link to="/accounts/savings" className="account-card">
            <span className="label">Harbor Savings ••7730</span>
            <span className="balance">{money(state.savings)}</span>
            <span className="sub">Available balance</span>
          </Link>
          <Link to="/accounts/card" className="account-card">
            <span className="label">Harbor Rewards Visa ••1956</span>
            <span className="balance">{money(state.cardCurrent)}</span>
            <span className="sub">
              Statement {money(state.cardStatement)} · Min due {money(state.cardMinDue)} · Due Oct 12, 2026
            </span>
          </Link>
        </div>

        <div className="dashboard-grid">
          <div>
            <div className="quick-actions">
              <Link to="/transfer" className="btn btn-navy">
                Transfer
              </Link>
              <Link to="/pay-bills" className="btn btn-navy">
                Pay Entity
              </Link>
              <Link to="/pay-card" className="btn btn-navy">
                Pay card
              </Link>
              <button type="button" className="btn btn-navy" onClick={notInDemo}>
                Deposit check
              </button>
              <button type="button" className="btn btn-navy" onClick={notInDemo}>
                Send money
              </button>
              <Link to="/statements" className="btn btn-navy">
                Statements
              </Link>
            </div>

            <section>
              <h2>Recent activity</h2>
              <table className="txn-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Description</th>
                    <th>Account</th>
                    <th>Category</th>
                    <th>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((t) => (
                    <tr key={t.id}>
                      <td>{t.date}</td>
                      <td>{t.description}</td>
                      <td style={{ textTransform: "capitalize" }}>{t.account}</td>
                      <td>{t.category}</td>
                      <td className={t.amount < 0 ? "amount-neg" : "amount-pos"}>{money(t.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          </div>

          <aside>
            <div className="side-promo">
              <b>You're pre-approved for a personal loan</b>
              <p>Borrow up to $15,000 at a rate as low as 8.99% APR.</p>
              <button type="button" className="linkbtn" onClick={notInDemo} style={{ marginTop: 8 }}>
                See offer
              </button>
            </div>
            <div className="side-promo">
              <b>Refer a friend, get $75</b>
              <p>When they open a checking account and set up direct deposit.</p>
              <button type="button" className="linkbtn" onClick={notInDemo} style={{ marginTop: 8 }}>
                Refer now
              </button>
            </div>
          </aside>
        </div>
      </div>
    </>
  );
}
