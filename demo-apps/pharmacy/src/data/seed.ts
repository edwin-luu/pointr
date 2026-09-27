import type { PharmacyState, Provider } from "./types.ts";

export const PROVIDERS: Provider[] = [
  { id: "alvarez", name: "Dr. Maria Alvarez, MD", specialty: "Family medicine", badge: "Your primary care doctor" },
  { id: "chen", name: "Dr. James Chen, MD", specialty: "Internal medicine" },
  { id: "patel", name: "Kim Patel, NP", specialty: "Nurse practitioner" },
];

export function buildInitialPharmacyState(): PharmacyState {
  return {
    prescriptions: [
      {
        id: "rx-lisinopril",
        name: "Lisinopril 10 mg",
        purpose: "high blood pressure",
        refillsLeft: 3,
        lastFilled: "Aug 28, 2026",
        status: "refillable",
      },
      {
        id: "rx-levothyroxine",
        name: "Levothyroxine 50 mcg",
        purpose: "thyroid",
        refillsLeft: 2,
        status: "refillable",
      },
      {
        id: "rx-metformin",
        name: "Metformin 500 mg",
        purpose: "blood sugar",
        refillsLeft: 0,
        status: "no-refills",
      },
      {
        id: "rx-atorvastatin",
        name: "Atorvastatin 20 mg",
        purpose: "cholesterol",
        refillsLeft: 0,
        lastFilled: "Sep 20, 2026",
        status: "too-early",
        availableDate: "Oct 15, 2026",
      },
    ],
    orders: [
      { id: "SP-20418", item: "Levothyroxine 50 mcg", status: "Ready for pickup", date: "Sep 24, 2026" },
      { id: "SP-19877", item: "Lisinopril 10 mg", status: "Picked up", date: "Aug 28, 2026" },
    ],
    appointments: [],
  };
}
