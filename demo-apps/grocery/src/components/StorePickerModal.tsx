import { Modal } from "@demo/shared";
import { STORES } from "../data/catalog.ts";
import { useGroceryStateCtx } from "../state/GroceryStateContext.tsx";

export default function StorePickerModal({ onClose }: { onClose: () => void }) {
  const { state, setStore } = useGroceryStateCtx();

  return (
    <Modal titleId="store-picker-title" title="Choose your store" onClose={onClose} size="small">
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {STORES.map((s) => (
          <button
            key={s.id}
            type="button"
            className="window-btn"
            aria-pressed={state.storeId === s.id}
            style={{ textAlign: "left", width: "100%" }}
            onClick={() => {
              setStore(s.id);
              onClose();
            }}
          >
            <b>{s.name}</b> - {s.area}
          </button>
        ))}
      </div>
    </Modal>
  );
}
