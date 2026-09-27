import { notInDemo } from "@demo/shared";

const COLUMNS: Record<string, string[]> = {
  Banking: ["Checking", "Savings", "CDs", "Credit cards", "Debit cards", "ATM & branches"],
  Borrowing: ["Personal loans", "Auto loans", "Mortgages", "Home equity", "Refinance"],
  Business: ["Business checking", "Merchant services", "Business loans", "Payroll"],
  Learn: ["Financial education", "Calculators", "Security center", "Fraud prevention"],
  About: ["About Harbor Bank", "Careers", "Newsroom", "Community", "Accessibility"],
};

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="container">
        <div className="footer-grid">
          {Object.entries(COLUMNS).map(([title, links]) => (
            <div key={title}>
              <h4>{title}</h4>
              <ul>
                {links.map((label) => (
                  <li key={label}>
                    <button type="button" className="linklike" onClick={notInDemo}>
                      {label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="footer-bottom">
          Harbor Bank is a made-up bank created for this demo. Member FDIC (not really). &copy; 2026 Harbor Bank.
        </div>
      </div>
    </footer>
  );
}
