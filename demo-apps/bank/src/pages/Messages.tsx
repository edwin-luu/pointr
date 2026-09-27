import { Link } from "react-router";
import { useBankStateCtx } from "../state/BankStateContext.tsx";

export default function Messages() {
  const { state } = useBankStateCtx();

  return (
    <div className="container" style={{ padding: "34px 20px 60px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1>My messages</h1>
        <Link to="/messages/new" className="btn btn-navy btn-sm">
          New message
        </Link>
      </div>

      {state.messages.length === 0 ? (
        <p style={{ color: "#5b6b83" }}>You haven't sent any messages yet.</p>
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {state.messages.map((m) => (
            <li key={m.id} className="tile" style={{ marginBottom: 12 }}>
              <b>{m.subject || "(no subject)"}</b>
              <p style={{ margin: "2px 0" }}>
                {m.topic} · {m.date}
              </p>
              <p>{m.body}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
