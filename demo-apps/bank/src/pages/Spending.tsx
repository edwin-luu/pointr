import { useMemo, useState } from "react";
import { money } from "@demo/shared";
import { useBankStateCtx } from "../state/BankStateContext.tsx";
import type { Category } from "../data/types.ts";

const SPEND_CATEGORIES: Category[] = [
  "Groceries",
  "Dining",
  "Gas",
  "Utilities",
  "Shopping",
  "Health",
  "Entertainment",
  "Transportation",
];

const COLORS: Record<string, string> = {
  Groceries: "#0b2545",
  Dining: "#e0a526",
  Gas: "#5b6b83",
  Utilities: "#1c7c3f",
  Shopping: "#b3261e",
  Health: "#133a6b",
  Entertainment: "#8a5cf6",
  Transportation: "#d9822b",
};

const MONTHS = [
  { value: "2026-07", label: "July 2026" },
  { value: "2026-08", label: "August 2026" },
  { value: "2026-09", label: "September 2026 (month to date)" },
];

export default function Spending() {
  const { state } = useBankStateCtx();
  const [month, setMonth] = useState("2026-09");
  const [selected, setSelected] = useState<string | null>(null);

  const monthTx = useMemo(
    () => state.transactions.filter((t) => t.date.startsWith(month) && SPEND_CATEGORIES.includes(t.category as Category) && t.amount < 0),
    [state.transactions, month],
  );

  const byCategory = useMemo(() => {
    const map = new Map<string, { total: number; count: number }>();
    for (const t of monthTx) {
      const cur = map.get(t.category) ?? { total: 0, count: 0 };
      cur.total += Math.abs(t.amount);
      cur.count += 1;
      map.set(t.category, cur);
    }
    return SPEND_CATEGORIES.filter((c) => map.has(c)).map((c) => ({ category: c, ...map.get(c)! }));
  }, [monthTx]);

  const total = byCategory.reduce((s, c) => s + c.total, 0);

  let acc = 0;
  const gradientParts = byCategory.map((c) => {
    const start = (acc / total) * 100;
    acc += c.total;
    const end = (acc / total) * 100;
    return `${COLORS[c.category]} ${start}% ${end}%`;
  });
  const gradient = total > 0 ? `conic-gradient(${gradientParts.join(", ")})` : "#eef1f5";

  const detailRows = selected ? monthTx.filter((t) => t.category === selected) : [];

  return (
    <div className="container" style={{ padding: "34px 20px 60px" }}>
      <h1>Spending insights</h1>
      <div className="field" style={{ maxWidth: 320 }}>
        <label htmlFor="spend-month">Month</label>
        <select
          id="spend-month"
          value={month}
          onChange={(e) => {
            setMonth(e.target.value);
            setSelected(null);
          }}
        >
          {MONTHS.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
      </div>

      <div className="spend-grid">
        <div className="donut-wrap">
          <div
            style={{
              width: 220,
              height: 220,
              borderRadius: "50%",
              background: gradient,
              display: "grid",
              placeItems: "center",
            }}
            role="img"
            aria-label={`Spending by category for ${month}, total ${money(total)}`}
          >
            <div
              style={{
                width: 140,
                height: 140,
                borderRadius: "50%",
                background: "#fff",
                display: "grid",
                placeItems: "center",
                textAlign: "center",
              }}
            >
              <div>
                <div style={{ fontSize: "1.3rem", fontWeight: 700, color: "#0b2545" }}>{money(total)}</div>
                <div style={{ fontSize: "0.78rem", color: "#5b6b83" }}>total spent</div>
              </div>
            </div>
          </div>
        </div>

        <div>
          <table className="txn-table">
            <thead>
              <tr>
                <th>Category</th>
                <th>Amount</th>
                <th>% of total</th>
                <th>Transactions</th>
              </tr>
            </thead>
            <tbody>
              {byCategory.map((c) => (
                <tr key={c.category} style={{ cursor: "pointer" }} onClick={() => setSelected(c.category === selected ? null : c.category)}>
                  <td>
                    <button type="button" className="cat-row" aria-pressed={selected === c.category}>
                      <span className="cat-swatch" style={{ background: COLORS[c.category] }} aria-hidden="true" />
                      {c.category}
                    </button>
                  </td>
                  <td>{money(c.total)}</td>
                  <td>{total > 0 ? Math.round((c.total / total) * 100) : 0}%</td>
                  <td>{c.count}</td>
                </tr>
              ))}
              {byCategory.length === 0 && (
                <tr>
                  <td colSpan={4} style={{ color: "#5b6b83" }}>
                    No spending recorded for this month.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {selected && (
            <div style={{ marginTop: 20 }}>
              <h2>{selected} transactions</h2>
              <table className="txn-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Description</th>
                    <th>Account</th>
                    <th>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {detailRows.map((t) => (
                    <tr key={t.id}>
                      <td>{t.date}</td>
                      <td>{t.description}</td>
                      <td style={{ textTransform: "capitalize" }}>{t.account}</td>
                      <td className="amount-neg">{money(t.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
