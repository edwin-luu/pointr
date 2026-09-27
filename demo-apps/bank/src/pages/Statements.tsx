import { notInDemo } from "@demo/shared";

const STATEMENTS = [
  { month: "September 2026", note: "Available Oct 1" },
  { month: "August 2026", note: "" },
  { month: "July 2026", note: "" },
  { month: "June 2026", note: "" },
];

export default function Statements() {
  return (
    <div className="container" style={{ padding: "34px 20px 60px" }}>
      <h1>Statements</h1>
      <table className="statements-table" style={{ maxWidth: 640 }}>
        <thead>
          <tr>
            <th>Statement</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {STATEMENTS.map((s) => (
            <tr key={s.month}>
              <td>
                {s.month}
                {s.note && <span className="badge" style={{ marginLeft: 8 }}>{s.note}</span>}
              </td>
              <td>
                <button type="button" className="linkbtn" onClick={notInDemo}>
                  Download PDF
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
