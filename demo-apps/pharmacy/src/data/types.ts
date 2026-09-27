export type PrescriptionStatus = "refillable" | "no-refills" | "too-early" | "renewal-requested";

export type Prescription = {
  id: string;
  name: string;
  purpose: string;
  refillsLeft: number;
  lastFilled?: string;
  status: PrescriptionStatus;
  availableDate?: string;
};

export type Order = {
  id: string;
  item: string;
  status: "Preparing" | "Ready for pickup" | "Picked up";
  date: string;
  pickupDetails?: string;
};

export type Provider = {
  id: string;
  name: string;
  specialty: string;
  badge?: string;
};

export type Appointment = {
  id: string;
  providerId: string;
  providerName: string;
  visitType: string;
  mode: "In person" | "Video visit";
  date: string;
  time: string;
  reason?: string;
  status: "upcoming" | "cancelled";
};

export type PharmacyState = {
  prescriptions: Prescription[];
  orders: Order[];
  appointments: Appointment[];
};
