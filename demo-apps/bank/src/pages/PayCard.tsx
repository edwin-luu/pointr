import { useState } from "react";
import { Link } from "react-router";
import { money, randomConfirmationNumber } from "@demo/shared";
import { useBankStateCtx } from "../state/BankStateContext.tsx";

type AmountOption = "statement" | "min" | "current" | "other";

export default function PayCard() {
  const { state, payCard } = useBankStateCtx();
  const [step, setStep] = useState(1);
  const [amountOption, setAmountOption] = useState<AmountOption>("statement");
  const [otherAmount, setOtherAmount] = useState("");
  const [fromAccount, setFromAccount] = useState<"" | "checking" | "savings">("");
  const [dateOption, setDateOption] = useState<"today" | "pick">("today");
  const [pickedDate, setPickedDate] = useState("");
  const [error, setError] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [paidAmount, setPaidAmount] = useState(0);
  const [paidFrom, setPaidFrom] = useState<"checking" | "savings">("checking");

  function resolveAmount(): number {
    if (amountOption === "statement") return state.cardStatement;
    if (amountOption === "min") return state.cardMinDue;
    if (amountOption === "current") return state.cardCurrent;
    return Number(otherAmount);
  }

  function onContinue() {
    if (!fromAccount) {
      setError("Choose an account to pay from.");
      return;
    }
    const amount = resolveAmount();
    if (amountOption === "other") {
      if (!otherAmount || Number.isNaN(amount) || amount <= 0) {
        setError("Enter an amount greater than $0.");
        return;
      }
      if (amount > state.cardCurrent) {
        setError("Amount can't be more than the current balance.");
        return;
      }
    }
    const available = fromAccount === "checking" ? state.checking : state.savings;
    if (amount > available) {
      setError("Amount can't be more than the available balance of the account you chose.");
      return;
    }
    setError("");
    setStep(2);
  }

  function onSubmitPayment() {
    const amount = resolveAmount();
    payCard(amount, fromAccount as "checking" | "savings");
    setPaidAmount(amount);
    setPaidFrom(fromAccount as "checking" | "savings");
    setConfirmation(randomConfirmationNumber("HB-", 6));
    setStep(3);
  }

  return (
    <div className="container" style={{ padding: "34px 20px 60px" }}>
      <h1>Pay your credit card</h1>
      <div className="stepper-head">
        <div className={`step ${step === 1 ? "active" : "done"}`}>1. Payment details</div>
        <div className={`step ${step === 2 ? "active" : step > 2 ? "done" : ""}`}>2. Review</div>
        <div className={`step ${step === 3 ? "active" : ""}`}>3. Confirmation</div>
      </div>

      {step === 1 && (
        <div className="panel">
          <div className="field">
            <label>Card</label>
            <div>Harbor Rewards Visa ••1956</div>
          </div>

          <div className="field">
            <label>Amount</label>
            <div>
              <label className="radio-option">
                <input
                  type="radio"
                  name="amount"
                  checked={amountOption === "statement"}
                  onChange={() => setAmountOption("statement")}
                />
                <span>
                  <span className="opt-label">Statement balance {money(state.cardStatement)}</span>
                </span>
              </label>
              <label className="radio-option">
                <input
                  type="radio"
                  name="amount"
                  checked={amountOption === "min"}
                  onChange={() => setAmountOption("min")}
                />
                <span className="opt-label">Minimum due {money(state.cardMinDue)}</span>
              </label>
              <label className="radio-option">
                <input
                  type="radio"
                  name="amount"
                  checked={amountOption === "current"}
                  onChange={() => setAmountOption("current")}
                />
                <span className="opt-label">Current balance {money(state.cardCurrent)}</span>
              </label>
              <label className="radio-option">
                <input
                  type="radio"
                  name="amount"
                  checked={amountOption === "other"}
                  onChange={() => setAmountOption("other")}
                />
                <span style={{ flex: 1 }}>
                  <span className="opt-label">Other amount</span>
                  {amountOption === "other" && (
                    <div className="field" style={{ marginTop: 8, marginBottom: 0, maxWidth: 180 }}>
                      <label htmlFor="other-amount">Other amount</label>
                      <input
                        id="other-amount"
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={otherAmount}
                        onChange={(e) => setOtherAmount(e.target.value)}
                      />
                    </div>
                  )}
                </span>
              </label>
            </div>
          </div>

          <div className="field">
            <label htmlFor="from-account">Pay from</label>
            <select id="from-account" value={fromAccount} onChange={(e) => setFromAccount(e.target.value as "" | "checking" | "savings")}>
              <option value="">Choose an account</option>
              <option value="checking">Everyday Checking ••4821 {money(state.checking)}</option>
              <option value="savings">Harbor Savings ••7730 {money(state.savings)}</option>
            </select>
          </div>

          <div className="field">
            <label>Payment date</label>
            <label className="radio-option">
              <input type="radio" name="date" checked={dateOption === "today"} onChange={() => setDateOption("today")} />
              <span className="opt-label">Today</span>
            </label>
            <label className="radio-option">
              <input type="radio" name="date" checked={dateOption === "pick"} onChange={() => setDateOption("pick")} />
              <span style={{ flex: 1 }}>
                <span className="opt-label">Pick a date</span>
                {dateOption === "pick" && (
                  <div className="field" style={{ marginTop: 8, marginBottom: 0, maxWidth: 200 }}>
                    <label htmlFor="pick-date">Payment date</label>
                    <input id="pick-date" type="date" value={pickedDate} onChange={(e) => setPickedDate(e.target.value)} />
                  </div>
                )}
              </span>
            </label>
          </div>

          {error && <div className="form-error-banner">{error}</div>}

          <button type="button" className="btn btn-gold" onClick={onContinue}>
            Continue
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="panel">
          <h2>Review your payment</h2>
          <div className="summary-box">
            <div className="summary-row">
              <span>Pay to</span>
              <span>Harbor Rewards Visa ••1956</span>
            </div>
            <div className="summary-row">
              <span>From</span>
              <span>{fromAccount === "checking" ? "Everyday Checking ••4821" : "Harbor Savings ••7730"}</span>
            </div>
            <div className="summary-row">
              <span>Date</span>
              <span>{dateOption === "today" ? "Today" : pickedDate || "Today"}</span>
            </div>
            <div className="summary-row total">
              <span>Amount</span>
              <span>{money(resolveAmount())}</span>
            </div>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button type="button" className="btn btn-outline" onClick={() => setStep(1)}>
              Back
            </button>
            <button type="button" className="btn btn-gold" onClick={onSubmitPayment}>
              Submit payment
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
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
              <span>Amount</span>
              <span>{money(paidAmount)}</span>
            </div>
            <div className="summary-row">
              <span>From</span>
              <span>{paidFrom === "checking" ? "Everyday Checking ••4821" : "Harbor Savings ••7730"}</span>
            </div>
          </div>
          <Link to="/accounts" className="btn btn-navy">
            Back to accounts
          </Link>
        </div>
      )}
    </div>
  );
}
