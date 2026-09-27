import { useState } from "react";
import { usePharmacyStateCtx } from "../state/PharmacyStateContext.tsx";

const TABS = ["Allergies", "Lab results", "Immunizations", "Medications", "Care team"] as const;

export default function AccountHealth() {
  const { state } = usePharmacyStateCtx();
  const [tab, setTab] = useState<(typeof TABS)[number]>("Allergies");

  return (
    <div className="container" style={{ padding: "30px 22px 60px" }}>
      <h1>My health record</h1>

      <div className="tabs" role="tablist" aria-label="Health record sections">
        {TABS.map((t) => (
          <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </div>

      {tab === "Allergies" && (
        <ul className="health-list">
          <li>
            <b>Penicillin</b> - hives
          </li>
          <li>
            <b>Sulfa drugs</b> - rash
          </li>
        </ul>
      )}

      {tab === "Lab results" && (
        <ul className="health-list">
          <li>
            <b>A1C</b>: 6.1% (Aug 14, 2026)
          </li>
          <li>
            <b>LDL cholesterol</b>: 118 mg/dL (Aug 14, 2026)
          </li>
          <li>
            <b>Blood pressure</b>: 128/82 (Sep 3, 2026)
          </li>
        </ul>
      )}

      {tab === "Immunizations" && (
        <ul className="health-list">
          <li>
            <b>Flu</b> - Oct 2025
          </li>
          <li>
            <b>COVID-19 booster</b> - Sep 2025
          </li>
          <li>
            <b>Tdap</b> - Mar 2021
          </li>
        </ul>
      )}

      {tab === "Medications" && (
        <ul className="health-list">
          {state.prescriptions.map((rx) => (
            <li key={rx.id}>
              <b>{rx.name}</b> - for {rx.purpose}
            </li>
          ))}
        </ul>
      )}

      {tab === "Care team" && (
        <ul className="health-list">
          <li>
            <b>Dr. Maria Alvarez</b> - primary care · (305) 555-0110
          </li>
        </ul>
      )}
    </div>
  );
}
