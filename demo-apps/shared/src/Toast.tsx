import { useEffect, useState } from "react";
import "./Toast.css";

type ToastItem = { id: number; text: string };

let toasts: ToastItem[] = [];
let listeners: Array<(items: ToastItem[]) => void> = [];
let counter = 0;

function emit() {
  listeners.forEach((l) => l([...toasts]));
}

export function showToast(text: string): void {
  const id = ++counter;
  toasts = [...toasts, { id, text }];
  emit();
  setTimeout(() => {
    toasts = toasts.filter((t) => t.id !== id);
    emit();
  }, 3400);
}

export function notInDemo(): void {
  showToast("This part of the site isn't available in the demo.");
}

export function ToastHost() {
  const [items, setItems] = useState<ToastItem[]>(toasts);
  useEffect(() => {
    listeners.push(setItems);
    return () => {
      listeners = listeners.filter((l) => l !== setItems);
    };
  }, []);
  if (items.length === 0) return null;
  return (
    <div className="toast-host" role="status" aria-live="polite">
      {items.map((t) => (
        <div className="toast" key={t.id}>
          {t.text}
        </div>
      ))}
    </div>
  );
}
