import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { PROVIDERS } from "../data/seed.ts";
import { usePharmacyStateCtx } from "../state/PharmacyStateContext.tsx";

const VISIT_TYPES = ["Annual checkup", "Follow-up visit", "Sick visit"];
const SLOTS = ["9:00 AM", "10:00 AM", "11:00 AM", "1:00 PM", "2:00 PM", "3:00 PM", "4:00 PM"];

function buildDays() {
  const start = new Date("2026-09-28T00:00:00");
  const days: { date: string; label: string; weekend: boolean }[] = [];
  for (let i = 0; i < 14; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const weekend = d.getDay() === 0 || d.getDay() === 6;
    days.push({
      date: d.toISOString().slice(0, 10),
      label: d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }),
      weekend,
    });
  }
  return days;
}

function isUnavailable(date: string, slot: string): boolean {
  const day = Number(date.slice(-2));
  const idx = SLOTS.indexOf(slot);
  return (day + idx) % 4 === 0;
}

export default function AppointmentNew() {
  const { bookAppointment } = usePharmacyStateCtx();
  const navigate = useNavigate();
  const days = useMemo(buildDays, []);

  const [step, setStep] = useState(1);
  const [providerId, setProviderId] = useState(PROVIDERS[0].id);
  const [visitType, setVisitType] = useState(VISIT_TYPES[0]);
  const [mode, setMode] = useState<"In person" | "Video visit">("In person");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [reason, setReason] = useState("");
  const [done, setDone] = useState<{ providerName: string; date: string; time: string } | null>(null);

  const provider = PROVIDERS.find((p) => p.id === providerId)!;

  function onBook() {
    bookAppointment({ providerId, providerName: provider.name, visitType, mode, date, time, reason: reason || undefined });
    setDone({ providerName: provider.name, date, time });
  }

  if (done) {
    return (
      <div className="container" style={{ padding: "30px 22px 60px" }}>
        <div className="panel confirm-box">
          <div className="confirm-check" aria-hidden="true">
            ✓
          </div>
          <h2>Appointment booked</h2>
          <p>
            {done.providerName} - {done.date} at {done.time}
          </p>
          <button type="button" className="btn btn-primary" onClick={() => navigate("/care/appointments")}>
            View my appointments
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container" style={{ padding: "30px 22px 60px" }}>
      <h1>Book an appointment</h1>
      <div className="stepper-head">
        <div className={`step ${step === 1 ? "active" : "done"}`}>1. Provider</div>
        <div className={`step ${step === 2 ? "active" : step > 2 ? "done" : ""}`}>2. Visit type</div>
        <div className={`step ${step === 3 ? "active" : step > 3 ? "done" : ""}`}>3. Date &amp; time</div>
        <div className={`step ${step === 4 ? "active" : ""}`}>4. Review</div>
      </div>

      {step === 1 && (
        <div className="panel">
          <h2>Choose a provider</h2>
          {PROVIDERS.map((p) => (
            <label key={p.id} className={`provider-card ${providerId === p.id ? "selected" : ""}`}>
              <input type="radio" name="provider" checked={providerId === p.id} onChange={() => setProviderId(p.id)} />
              <span>
                <b>{p.name}</b>
                <div style={{ color: "var(--muted)", fontSize: "0.85rem" }}>{p.specialty}</div>
                {p.badge && <span className="badge">{p.badge}</span>}
              </span>
            </label>
          ))}
          <button type="button" className="btn btn-primary" onClick={() => setStep(2)} style={{ marginTop: 10 }}>
            Continue
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="panel">
          <h2>Visit type</h2>
          {VISIT_TYPES.map((v) => (
            <label key={v} className={`provider-card ${visitType === v ? "selected" : ""}`}>
              <input type="radio" name="visitType" checked={visitType === v} onChange={() => setVisitType(v)} />
              <b>{v}</b>
            </label>
          ))}
          <div className="field" style={{ marginTop: 14, maxWidth: 260 }}>
            <label htmlFor="mode">How would you like to meet?</label>
            <select id="mode" value={mode} onChange={(e) => setMode(e.target.value as "In person" | "Video visit")}>
              <option value="In person">In person</option>
              <option value="Video visit">Video visit</option>
            </select>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button type="button" className="btn btn-ghost" onClick={() => setStep(1)}>
              Back
            </button>
            <button type="button" className="btn btn-primary" onClick={() => setStep(3)}>
              Continue
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="panel" style={{ maxWidth: 720 }}>
          <h2>Pick a date and time</h2>
          <div className="calendar-grid">
            {days.map((d) => (
              <button
                type="button"
                key={d.date}
                className={`cal-day ${d.weekend ? "disabled" : ""} ${date === d.date ? "selected" : ""}`}
                disabled={d.weekend}
                onClick={() => {
                  setDate(d.date);
                  setTime("");
                }}
              >
                {d.label}
              </button>
            ))}
          </div>
          {date && (
            <div className="slot-grid">
              {SLOTS.map((s) => (
                <button
                  type="button"
                  key={s}
                  className={`slot-btn ${time === s ? "selected" : ""}`}
                  disabled={isUnavailable(date, s)}
                  onClick={() => setTime(s)}
                >
                  {isUnavailable(date, s) ? `${s} - Unavailable` : s}
                </button>
              ))}
            </div>
          )}
          <div style={{ display: "flex", gap: 10 }}>
            <button type="button" className="btn btn-ghost" onClick={() => setStep(2)}>
              Back
            </button>
            <button type="button" className="btn btn-primary" disabled={!date || !time} onClick={() => setStep(4)}>
              Continue
            </button>
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="panel">
          <h2>Review your appointment</h2>
          <div className="summary-box">
            <div className="summary-row">
              <span>Provider</span>
              <span>{provider.name}</span>
            </div>
            <div className="summary-row">
              <span>Visit type</span>
              <span>
                {visitType} ({mode})
              </span>
            </div>
            <div className="summary-row">
              <span>When</span>
              <span>
                {date} at {time}
              </span>
            </div>
          </div>
          <div className="field">
            <label htmlFor="reason">Reason for visit (optional)</label>
            <textarea id="reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button type="button" className="btn btn-ghost" onClick={() => setStep(3)}>
              Back
            </button>
            <button type="button" className="btn btn-primary" onClick={onBook}>
              Book appointment
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
