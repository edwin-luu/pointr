import { Link } from "react-router";
import { Modal } from "@demo/shared";

export default function OrderReadyModal({ onClose }: { onClose: () => void }) {
  return (
    <Modal titleId="order-ready-title" title="Your order is ready for pickup" onClose={onClose} size="small">
      <p>
        Good news, Edwin! Order <b>#SP-20418</b> is ready for pickup at SunPlaza, W Flagler St.
      </p>
      <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
        <Link to="/pharmacy/orders" className="btn btn-primary" onClick={onClose}>
          View order
        </Link>
        <button type="button" className="btn btn-ghost" onClick={onClose}>
          Dismiss
        </button>
      </div>
    </Modal>
  );
}
