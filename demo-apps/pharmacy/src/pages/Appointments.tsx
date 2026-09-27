import { useState } from "react";
import { Link } from "react-router";
import { Modal, notInDemo, showToast } from "@demo/shared";
import { usePharmacyStateCtx } from "../state/PharmacyStateContext.tsx";

export default function Appointments() {
  const { state, cancelAppointment } = usePharmacyStateCtx();
  const [confirming, setConfirming] = useState<string | null>(null);

  const upcoming = state.appointments.filter((a) => a.status === "upcoming");

  return (
    <div className="container" style={{ padding: "30px 22px 60px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1>My appointments</h1>
        <Link to="/care/appointments/new" className="btn btn-primary btn-sm">
          Book new
        </Link>
      </div>

      {upcoming.length === 0 ? (
        <p style={{ color: "var(--muted)" }}>You have no upcoming appointments.</p>
      ) : (
        <ul className="appt-list">
          {upcoming.map((a) => (
            <li key={a.id}>
              <div>
                <b>{a.providerName}</b>
                <div style={{ color: "var(--muted)", fontSize: "0.85rem" }}>
                  {a.visitType} ({a.mode}) · {a.date} at {a.time}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" className="btn btn-ghost btn-sm" onClick={notInDemo}>
                  Reschedule
                </button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setConfirming(a.id)}>
                  Cancel
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {confirming && (
        <Modal titleId="cancel-appt-title" title="Cancel this appointment?" onClose={() => setConfirming(null)} size="small">
          <p>This can't be undone. You'll need to book a new appointment if you change your mind.</p>
          <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                cancelAppointment(confirming);
                showToast("Appointment cancelled.");
                setConfirming(null);
              }}
            >
              Yes, cancel it
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setConfirming(null)}>
              Keep appointment
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
