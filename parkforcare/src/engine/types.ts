export type Assumptions = {
  /** Share of listed outpatients assumed to arrive by car. */
  carModeShare: number;
  /** Scales clinic-driven car demand without moving any listed appointment. */
  demandMultiplier: number;
  /** Minutes before the appointment the patient is asked to be at the department. */
  arrivalLeadMin: number;
  /** Extra minutes held on a bay after the booked slot, for clinic overrun. */
  overrunMin: number;
  /** Share of Horizon Multi-Storey that is open. Below 1 means a deck is closed. */
  horizonOpenFactor: number;
  staffScale: number;
  visitorScale: number;
};

export type Appointment = {
  id: string;
  date: string;
  patientName: string;
  departmentId: string;
  startMin: number;
  durationMin: number;
  /** How late this clinic is running. Extends the simulated parking stay. */
  delayMin: number;
  /** Later arrival the hospital has explicitly allowed. Zero means no such instruction. */
  approvedShiftMin: number;
  reference: string;
};

export type Reservation = {
  id: string;
  bayId: string;
  parkId: string;
  date: string;
  startMin: number;
  endMin: number;
  appointmentRef: string;
  kind: "general" | "accessible";
  status: "confirmed" | "cancelled";
  source: "patient" | "seed";
};

export type LedgerEvent = {
  id: string;
  title: string;
  detail: string;
};

export const DEFAULT_ASSUMPTIONS: Assumptions = {
  carModeShare: 0.4,
  demandMultiplier: 1,
  arrivalLeadMin: 25,
  overrunMin: 20,
  horizonOpenFactor: 1,
  staffScale: 1,
  visitorScale: 1,
};
