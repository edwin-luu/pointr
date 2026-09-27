import { useEffect, useState } from "react";
import { getItem, setItem } from "@demo/shared";
import { buildInitialPharmacyState } from "../data/seed.ts";
import type { Appointment, PharmacyState } from "../data/types.ts";

const PREFIX = "sunplaza:";
const KEY = "state";

function makeId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function randomOrderNumber(): string {
  let n = "";
  for (let i = 0; i < 5; i++) n += Math.floor(Math.random() * 10).toString();
  return `SP-${n}`;
}

export function usePharmacyState() {
  const [state, setState] = useState<PharmacyState>(
    () => getItem<PharmacyState | null>(PREFIX, KEY, null) ?? buildInitialPharmacyState(),
  );

  useEffect(() => {
    setItem(PREFIX, KEY, state);
  }, [state]);

  function placeRefillOrder(rxIds: string[], store: string, time: string): string {
    const orderId = randomOrderNumber();
    setState((prev) => {
      const names = prev.prescriptions.filter((r) => rxIds.includes(r.id)).map((r) => r.name);
      return {
        ...prev,
        prescriptions: prev.prescriptions.map((r) =>
          rxIds.includes(r.id) ? { ...r, refillsLeft: Math.max(0, r.refillsLeft - 1), lastFilled: "Today" } : r,
        ),
        orders: [
          {
            id: orderId,
            item: names.join(", "),
            status: "Preparing",
            date: new Date().toISOString().slice(0, 10),
            pickupDetails: `${store} • ${time}`,
          },
          ...prev.orders,
        ],
      };
    });
    return orderId;
  }

  function requestRenewal(rxId: string) {
    setState((prev) => ({
      ...prev,
      prescriptions: prev.prescriptions.map((r) => (r.id === rxId ? { ...r, status: "renewal-requested" } : r)),
    }));
  }

  function bookAppointment(appt: Omit<Appointment, "id" | "status">): string {
    const id = makeId("appt");
    setState((prev) => ({
      ...prev,
      appointments: [...prev.appointments, { ...appt, id, status: "upcoming" }],
    }));
    return id;
  }

  function cancelAppointment(id: string) {
    setState((prev) => ({
      ...prev,
      appointments: prev.appointments.filter((a) => a.id !== id),
    }));
  }

  return { state, placeRefillOrder, requestRenewal, bookAppointment, cancelAppointment };
}
