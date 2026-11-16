import { DEFAULT_ASSUMPTIONS, type Assumptions } from "../engine/types";
import type { ScenarioId } from "./scenario-ids";

export type { ScenarioId };

export type Scenario = {
  id: ScenarioId;
  name: string;
  kicker: string;
  date: string;
  nowMin: number;
  /** Time the hospital board opens on. Defaults to the patient clock. */
  deskMin?: number;
  originId: string;
  assumptions: Assumptions;
  steps: string[];
};

export const SCENARIOS: Scenario[] = [
  {
    id: "normal",
    name: "Normal appointment",
    kicker: "10:30 cardiology · a bay can be held",
    date: "2026-11-17",
    nowMin: 8 * 60 + 20,
    originId: "bedminster",
    assumptions: { ...DEFAULT_ASSUMPTIONS },
    steps: [
      "Appointment: Jordan Hale, cardiology, 10:30. Note the recommended arrival.",
      "Parking: Horizon should look workable. Reserve a general bay and read the confirmation.",
      "Journey: Bedminster by car. Show departure, search, walk and the buffer explanation.",
      "Switch to the hospital view. The day peaks without a shortage warning.",
    ],
  },
  {
    id: "shortage",
    name: "Parking shortage",
    kicker: "Extra lists · one deck closed",
    date: "2026-11-18",
    nowMin: 7 * 60 + 40,
    deskMin: 10 * 60,
    originId: "bradley",
    assumptions: {
      ...DEFAULT_ASSUMPTIONS,
      carModeShare: 0.72,
      demandMultiplier: 2.3,
      horizonOpenFactor: 0.5,
      staffScale: 1.05,
      visitorScale: 1.25,
    },
    steps: [
      "Appointment: Alex Okonkwo, orthopaedics, 09:15, coming from Bradley Stoke.",
      "Parking: Horizon and Garden bookable bays are already held. The forecast is over capacity.",
      "Offer Riverside, or switch the journey to the bus.",
      "Hospital view opens at 10:00, when the forecast is over capacity. Read the shortage warning. Do not invent a clinic change.",
    ],
  },
  {
    id: "delay",
    name: "Clinic delay",
    kicker: "Respiratory list · 45 min late",
    date: "2026-11-19",
    nowMin: 9 * 60 + 5,
    originId: "clifton",
    assumptions: { ...DEFAULT_ASSUMPTIONS },
    steps: [
      "Alerts: the respiratory list is 45 minutes late. The original arrival stays in place.",
      "The clinic instruction allows arriving 20 minutes later, and still before the time on the letter. Apply it only if you want to show that.",
      "A Horizon bay is already held. Extend it, or shift the start after the instruction is accepted.",
      "Say clearly that the appointment itself has not been moved.",
    ],
  },
];

export function scenarioById(id: ScenarioId): Scenario {
  const found = SCENARIOS.find((s) => s.id === id);
  if (!found) throw new Error(id);
  return found;
}
