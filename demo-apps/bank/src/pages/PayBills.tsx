import { useState } from "react";
import { money, notInDemo, randomConfirmationNumber } from "@demo/shared";
import { useBankStateCtx } from "../state/BankStateContext.tsx";

const PAYEES = ["Sunshine Electric", "Bay Water Utility", "Metro Internet", "City of Miami Parking"];

export default function PayBills() {
  const { state, payBill } = useBankStateCtx();
  const [payee, setPayee] = useState<string | null>(null);
  const [step, setStep] = useState(1);
  const [amount, setAmount] = useState("");
  const [fromAccount, setFromAccount] = useState<"" | "checking" | "savings">("");
  const [error, setError] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [paid, setPaid] = useState({ amount: 0, from: "checking" as "checking" | "savings" });

  function startPay(name: string) {
    setPayee(name);
    setStep(1);
    setAmount("");
    setFromAccount("");
    setError("");
  }

  function onContinue() {
    const n = Number(amount);
    if (!fromAccount) {
      setError("Choose an account to pay from.");
      return;
    }
    if (!amount || Number.isNaN(n) || n <= 0) {
      setError("Enter an amount greater than $0.");
      return;
    }
    const available = fromAccount === "checking" ? state.checking : state.savings;
    if (n > available) {
      setError("Amount can't be more than the available balance of the account you chose.");
      return;
    }
    setError("");
    setStep(2);
  }

  function onSubmit() {
    const n = Number(amount);
    payBill(payee!, n, fromAccount as "checking" | "savings");
    setPaid({ amount: n, from: fromAccount as "checking" | "savings" });
    setConfirmation(randomConfirmationNumber("HB-", 6));
    setStep(3);
  }

  return (
    <div className="container" style={{ padding: "34px 20px 60px" }}>
      <h1>Pay a bill</h1>

      {!payee && (
        <>
          <table className="txn-table" style={{ maxWidth: 640 }}>
            <thead>
              <tr>
                <th>Payee</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {PAYEES.map((name) => (
                <tr key={name}>
                  <td>{name}</td>
                  <td>
                    <button type="button" className="btn btn-navy btn-sm" onClick={() => startPay(name)}>
                      Pay
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button type="button" className="linkbtn" style={{ marginTop: 14 }} onClick={notInDemo}>
            Add a payee
          </button>
        </>
      )}

      {payee && step === 1 && (
        <div className="panel">
          <h2>Pay {payee}</h2>
          <div className="field">
            <label htmlFor="bill-amount">Amount</label>
            <input id="bill-amount" type="number" min="0.01" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="bill-from">Pay from</label>
            <select id="bill-from" value={fromAccount} onChange={(e) => setFromAccount(e.target.value as "" | "checking" | "savings")}>
              <option value="">Choose an account</option>
              <option value="checking">Everyday Checking ••4821 {money(state.checking)}</option>
              <option value="savings">Harbor Savings ••7730 {money(state.savings)}</option>
            </select>
          </div>
          {error && <div className="form-error-banner">{error}</div>}
          <div style={{ display: "flex", gap: 10 }}>
            <button type="button" className="btn btn-outline" onClick={() => setPayee(null)}>
              Cancel
            </button>
            <button type="button" className="btn btn-gold" onClick={onContinue}>
              Continue
            </button>
          </div>
        </div>
      )}

      {payee && step === 2 && (
        <div className="panel">
          <h2>Review payment</h2>
          <div className="summary-box">
            <div className="summary-row">
              <span>Payee</span>
              <span>{payee}</span>
            </div>
            <div className="summary-row">
              <span>From</span>
              <span>{fromAccount === "checking" ? "Everyday Checking ••4821" : "Harbor Savings ••7730"}</span>
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
              Submit payment
            </button>
          </div>
        </div>
      )}

      {payee && step === 3 && (
        <div className="panel confirm-box">
          <div className="confirm-check" aria-hidden="true">
            ✓
          </div>
          <h2>Payment scheduled</h2>
          <p>
            Confirmation number <b>{confirmation}</b>
          </p>
          <div className="summary-box" style={{ textAlign: "left" }}>
            <div className="summary-row">
              <span>Payee</span>
              <span>{payee}</span>
            </div>
            <div className="summary-row">
              <span>Amount</span>
              <span>{money(paid.amount)}</span>
            </div>
          </div>
          <button type="button" className="btn btn-navy" onClick={() => setPayee(null)}>
            Pay another bill
          </button>
        </div>
      )}
    </div>
  );
}
