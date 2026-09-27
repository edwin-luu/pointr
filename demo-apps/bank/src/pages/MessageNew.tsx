import { useState, type FormEvent } from "react";
import { Link } from "react-router";
import { useBankStateCtx } from "../state/BankStateContext.tsx";

const TOPICS = ["Card question", "Payment issue", "Account question", "Other"];

export default function MessageNew() {
  const { sendMessage } = useBankStateCtx();
  const [topic, setTopic] = useState(TOPICS[0]);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sent, setSent] = useState(false);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    sendMessage(topic, subject, body);
    setSent(true);
  }

  if (sent) {
    return (
      <div className="container" style={{ padding: "34px 20px 60px", maxWidth: 560 }}>
        <div className="panel confirm-box">
          <div className="confirm-check" aria-hidden="true">
            ✓
          </div>
          <h2>Message sent</h2>
          <p>We'll reply within 1 business day.</p>
          <Link to="/messages" className="btn btn-navy">
            View my messages
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container" style={{ padding: "34px 20px 60px" }}>
      <h1>Send a secure message</h1>
      <form className="panel" onSubmit={onSubmit}>
        <div className="field">
          <label htmlFor="msg-topic">Topic</label>
          <select id="msg-topic" value={topic} onChange={(e) => setTopic(e.target.value)}>
            {TOPICS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="msg-subject">Subject</label>
          <input id="msg-subject" type="text" value={subject} onChange={(e) => setSubject(e.target.value)} required />
        </div>
        <div className="field">
          <label htmlFor="msg-body">Message</label>
          <textarea id="msg-body" rows={5} value={body} onChange={(e) => setBody(e.target.value)} required />
        </div>
        <button type="submit" className="btn btn-gold">
          Send message
        </button>
      </form>
    </div>
  );
}
