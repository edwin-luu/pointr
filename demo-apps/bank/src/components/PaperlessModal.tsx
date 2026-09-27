import { Modal, showToast } from "@demo/shared";
import { useBankStateCtx } from "../state/BankStateContext.tsx";

export default function PaperlessModal({ onClose }: { onClose: () => void }) {
  const { setPaperless } = useBankStateCtx();

  return (
    <Modal titleId="paperless-title" title="Go paperless with Harbor Bank" onClose={onClose} size="small">
      <div className="paperless-icon" aria-hidden="true">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <path d="M6 3h9l3 3v15H6z" stroke="currentColor" strokeWidth="1.6" />
          <path d="M9 12c1.5 2 4.5 2 6 0" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </div>
      <p>Skip the paper. Get statements and notices in your inbox instead, usually a few days faster.</p>
      <div className="row" style={{ display: "flex", gap: 10, marginTop: 16 }}>
        <button
          type="button"
          className="btn btn-navy"
          onClick={() => {
            setPaperless(true);
            showToast("You're now paperless.");
            onClose();
          }}
        >
          Go paperless
        </button>
        <button type="button" className="btn btn-outline" onClick={onClose}>
          Maybe later
        </button>
      </div>
    </Modal>
  );
}
