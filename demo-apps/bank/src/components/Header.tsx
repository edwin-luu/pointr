import { Link, useNavigate } from "react-router";
import { notInDemo, useAuth } from "@demo/shared";

const NAV_LINKS = ["Business", "Loans", "Mortgages", "Investing", "Learn"];

export default function Header() {
  const auth = useAuth();
  const navigate = useNavigate();

  return (
    <>
      <div className="util-bar">
        <div className="container">
          <button type="button" className="linklike" onClick={notInDemo}>
            Locations
          </button>
          <button type="button" className="linklike" onClick={notInDemo}>
            Contact us
          </button>
          <button type="button" className="linklike" onClick={notInDemo}>
            Espa&ntilde;ol
          </button>
          <span className="spacer" />
          <button type="button" className="linklike" aria-label="Search Harbor Bank" onClick={notInDemo}>
            Search
          </button>
        </div>
      </div>
      <nav className="main-nav" aria-label="Primary">
        <div className="container">
          <Link to="/" className="brand">
            <span className="mark" aria-hidden="true">
              H
            </span>
            Harbor Bank
          </Link>
          <ul className="nav-links">
            <li>
              <Link to="/">Personal</Link>
            </li>
            {auth.loggedIn && (
              <li>
                <Link to="/spending">Spending insights</Link>
              </li>
            )}
            {NAV_LINKS.map((label) => (
              <li key={label}>
                <button type="button" className="linklike" onClick={notInDemo}>
                  {label}
                </button>
              </li>
            ))}
            <li>
              <Link to="/help">Help</Link>
            </li>
          </ul>
          <div className="nav-right">
            {auth.loggedIn ? (
              <>
                <span className="greeting">Hi, {auth.name.split(" ")[0]}</span>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => {
                    auth.logout();
                    navigate("/");
                  }}
                >
                  Log out
                </button>
              </>
            ) : (
              <Link to="/login" className="btn btn-gold btn-sm">
                Sign in
              </Link>
            )}
          </div>
        </div>
      </nav>
    </>
  );
}
