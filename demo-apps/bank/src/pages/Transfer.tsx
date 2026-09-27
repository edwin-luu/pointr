import { useState } from "react";
import { Link } from "react-router";
import { money } from "@demo/shared";
import { useBankStateCtx } from "../state/BankStateContext.tsx";

type Acct = "" | "checking" | "savings";

export default function Transfer() {
  const { state, transfer } = useBankStateCtx();
  const [step, setStep] = useState(1);
  const [from, setFrom] = useState<Acct>("checking");
  const [to, setTo] = useState<Acct>("savings");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState({ amount: 0, from: "checking" as "checking" | "savings", to: "savings" as "checking" | "savings" });

  function label(a: Acct) {
    return a === "checking" ? "Everyday Checking ••4821" : a === "savings" ? "Harbor Savings ••7730" : "";
  }

  function onContinue() {
    const n = Number(amount);
    if (!from || !to) {
      setError("Choose both accounts.");
      return;
    }
    if (from === to) {
      setError("Choose two different accounts.");
      return;
    }
    if (!amount || Number.isNaN(n) || n <= 0) {
      setError("Enter an amount greater than $0.");
      return;
    }
    const available = from === "checking" ? state.checking : state.savings;
    if (n > available) {
      setError("Amount can't be more than the available balance of the account you chose.");
      return;
    }
    setError("");
    setStep(2);
  }

  function onSubmit() {
    const n = Number(amount);
    transfer(n, from as "checking" | "savings", to as "checking" | "savings");
    setDone({ amount: n, from: from as "checking" | "savings", to: to as "checking" | "savings" });
    setStep(3);
  }

  return (
    <div className="container" style={{ padding: "34px 20px 60px" }}>
      <h1>Transfer money</h1>

      {step === 1 && (
        <div className="panel">
          <div className="field">
            <label htmlFor="tr-from">From</label>
            <select id="tr-from" value={from} onChange={(e) => setFrom(e.target.value as Acct)}>
              <option value="checking">Everyday Checking ••4821 {money(state.checking)}</option>
              <option value="savings">Harbor Savings ••7730 {money(state.savings)}</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="tr-to">To</label>
            <select id="tr-to" value={to} onChange={(e) => setTo(e.target.value as Acct)}>
              <option value="savings">Harbor Savings ••7730 {money(state.savings)}</option>
              <option value="checking">Everyday Checking ••4821 {money(state.checking)}</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="tr-amount">Amount</label>
            <input id="tr-amount" type="number" min="0.01" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          {error && <div className="form-error-banner">{error}</div>}
          <button type="button" className="btn btn-gold" onClick={onContinue}>
            Continue
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="panel">
          <h2>Review transfer</h2>
          <div className="summary-box">
            <div className="summary-row">
              <span>From</span>
              <span>{label(from)}</span>
            </div>
            <div className="summary-row">
              <span>To</span>
              <span>{label(to)}</span>
            </div>
            <div className="summary-row total">
              <span>Amount</span>
              <span>{money(Number(amount))}</span>
            </div>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button type="button" className="btn btn-outline" onClick={() => setStep(1)}>
              Back
            </button>
            <button type="button" className="btn btn-gold" onClick={onSubmit}>
              Submit transfer
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="panel confirm-box">
          <div className="confirm-check" aria-hidden="true">
            ✓
          </div>
          <h2>Transfer complete</h2>
          <p>
            {money(done.amount)} moved from {label(done.from)} to {label(done.to)}.
          </p>
          <Link to="/accounts" className="btn btn-navy">
            Back to accounts
          </Link>
        </div>
      )}
    </div>
  );
}
