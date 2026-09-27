import { useMemo, useState } from "react";
import { useParams } from "react-router";
import { money } from "@demo/shared";
import { useBankStateCtx } from "../state/BankStateContext.tsx";

const LABELS: Record<string, string> = {
  checking: "Everyday Checking ••4821",
  savings: "Harbor Savings ••7730",
  card: "Harbor Rewards Visa ••1956",
};

const MONTHS = [
  { value: "", label: "All months" },
  { value: "2026-07", label: "July 2026" },
  { value: "2026-08", label: "August 2026" },
  { value: "2026-09", label: "September 2026" },
];

export default function AccountDetail() {
  const { type } = useParams<{ type: string }>();
  const { state } = useBankStateCtx();
  const [query, setQuery] = useState("");
  const [month, setMonth] = useState("");

  const key = type === "checking" || type === "savings" || type === "card" ? type : "checking";
  const balance = key === "checking" ? state.checking : key === "savings" ? state.savings : state.cardCurrent;

  const rows = useMemo(() => {
    return state.transactions
      .filter((t) => t.account === key)
      .filter((t) => (month ? t.date.startsWith(month) : true))
      .filter((t) => (query ? t.description.toLowerCase().includes(query.toLowerCase()) : true))
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [state.transactions, key, month, query]);

  return (
    <>
      <div className="page-head">
        <div className="container">
          <div>
            <h1>{LABELS[key]}</h1>
            <p style={{ color: "#cfd9ea", margin: "4px 0 0" }}>Balance: {money(balance)}</p>
          </div>
        </div>
      </div>

      <div className="container" style={{ paddingTop: 24, paddingBottom: 40 }}>
        <div className="filter-row">
          <label htmlFor="acct-search" className="sr-only" style={{ position: "absolute", width: 1, height: 1, overflow: "hidden" }}>
            Search transactions
          </label>
          <input
            id="acct-search"
            type="text"
            placeholder="Search transactions"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <label htmlFor="acct-month" className="sr-only" style={{ position: "absolute", width: 1, height: 1, overflow: "hidden" }}>
            Filter by month
          </label>
          <select id="acct-month" value={month} onChange={(e) => setMonth(e.target.value)}>
            {MONTHS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>

        <table className="txn-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Description</th>
              <th>Category</th>
              <th>Amount</th>
              <th>Running balance</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => (
              <tr key={t.id}>
                <td>{t.date}</td>
                <td>{t.description}</td>
                <td>{t.category}</td>
                <td className={t.amount < 0 ? "amount-neg" : "amount-pos"}>{money(t.amount)}</td>
                <td>{money(t.balanceAfter)}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} style={{ color: "#5b6b83" }}>
                  No transactions match your search.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
