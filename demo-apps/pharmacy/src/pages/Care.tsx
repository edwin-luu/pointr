import { Link } from "react-router";
import { notInDemo } from "@demo/shared";

export default function Care() {
  return (
    <div className="container" style={{ padding: "30px 22px 60px" }}>
      <h1>Health services</h1>
      <div className="card-grid">
        <Link to="/care/appointments/new" className="action-card">
          <span className="action-ico" aria-hidden="true">
            +
          </span>
          <b>Book an appointment</b>
          <small>See a doctor or nurse practitioner</small>
        </Link>
        <button type="button" className="action-card" onClick={notInDemo}>
          <span className="action-ico" aria-hidden="true">
            +
          </span>
          <b>Vaccines</b>
          <small>Schedule a shot</small>
        </button>
        <button type="button" className="action-card" onClick={notInDemo}>
          <span className="action-ico" aria-hidden="true">
            ⚛
          </span>
          <b>Lab tests</b>
          <small>Book bloodwork and screenings</small>
        </button>
      </div>
    </div>
  );
}
