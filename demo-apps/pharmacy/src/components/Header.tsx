import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { notInDemo, useAuth } from "@demo/shared";

export default function Header() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  return (
    <nav className="s-nav" aria-label="Primary">
      <div className="container">
        <Link to="/" className="brand">
          <span className="dot" aria-hidden="true" />
          SunPlaza Pharmacy
        </Link>
        <Link to="/">Home</Link>
        <Link to="/pharmacy">Pharmacy</Link>
        <Link to="/care">Health services</Link>
        <button type="button" className="linklike" onClick={notInDemo}>
          Shop
        </button>
        <button type="button" className="linklike" onClick={notInDemo}>
          Photo
        </button>
        <button type="button" className="linklike" onClick={notInDemo}>
          Store locator
        </button>
        {auth.loggedIn ? (
          <div className="account-menu">
            <button
              type="button"
              className="account-menu-btn"
              aria-haspopup="true"
              aria-expanded={open}
              onClick={() => setOpen((v) => !v)}
            >
              Hi, {auth.name.split(" ")[0]}
            </button>
            {open && (
              <ul className="account-menu-list" role="menu" onMouseLeave={() => setOpen(false)}>
                <li>
                  <Link to="/account/health" onClick={() => setOpen(false)}>
                    My health record
                  </Link>
                </li>
                <li>
                  <Link to="/pharmacy/refills" onClick={() => setOpen(false)}>
                    Prescriptions
                  </Link>
                </li>
                <li>
                  <Link to="/care/appointments" onClick={() => setOpen(false)}>
                    Appointments
                  </Link>
                </li>
                <li>
                  <Link to="/pharmacy/orders" onClick={() => setOpen(false)}>
                    Order history
                  </Link>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      auth.logout();
                      navigate("/");
                    }}
                  >
                    Sign out
                  </button>
                </li>
              </ul>
            )}
          </div>
        ) : (
          <Link to="/login" className="btn btn-primary btn-sm">
            Sign in
          </Link>
        )}
      </div>
    </nav>
  );
}
