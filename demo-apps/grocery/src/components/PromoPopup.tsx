import { Modal, notInDemo } from "@demo/shared";

export default function PromoPopup({ onClose }: { onClose: () => void }) {
  return (
    <Modal titleId="promo-title" title="50% off your first delivery" onClose={onClose} closeLabel="Close promotion" size="small">
      <div className="promo-popup" style={{ margin: -22, marginTop: -14 }}>
        <p style={{ margin: 0, fontSize: "1.05rem" }}>Use code at checkout on your first delivery order.</p>
        <div className="code">FRESH50</div>
        <button
          type="button"
          className="btn"
          style={{ background: "#fff", color: "var(--green-2)" }}
          onClick={() => {
            notInDemo();
            onClose();
          }}
        >
          Shop deals
        </button>
      </div>
    </Modal>
  );
}
