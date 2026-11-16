import { departmentById } from "../data/campus";
import { bandFor, type ParkForecast } from "./forecast";
import type { Appointment, Assumptions } from "./types";

export type Mode = "car" | "bus" | "train" | "cycle" | "walk";

export type Origin = {
  id: string;
  label: string;
  detail: string;
  minutes: Partial<Record<Mode, number>>;
};

export const ORIGINS: Origin[] = [
  {
    id: "bedminster",
    label: "Bedminster",
    detail: "BS3 · illustrative",
    minutes: { car: 18, bus: 32, cycle: 22, walk: 70 },
  },
  {
    id: "clifton",
    label: "Clifton",
    detail: "BS8 · illustrative",
    minutes: { car: 12, bus: 24, cycle: 10, walk: 28 },
  },
  {
    id: "bradley",
    label: "Bradley Stoke",
    detail: "BS32 · illustrative",
    minutes: { car: 28, bus: 55, train: 40, cycle: 55 },
  },
  {
    id: "gloucester",
    label: "Gloucester Road",
    detail: "BS7 · illustrative",
    minutes: { car: 14, bus: 26, cycle: 16, walk: 45 },
  },
  {
    id: "yate",
    label: "Yate",
    detail: "BS37 · illustrative",
    minutes: { car: 35, bus: 62, train: 38 },
  },
];

export const CUSTOM_ORIGIN: Origin = {
  id: "custom",
  label: "Typed place",
  detail: "Not matched to a preset",
  minutes: { car: 25, bus: 45, cycle: 35 },
};

export const MODE_LABEL: Record<Mode, string> = {
  car: "Car",
  bus: "Bus",
  train: "Train",
  cycle: "Bicycle",
  walk: "Walk",
};

export function originById(id: string): Origin {
  return ORIGINS.find((o) => o.id === id) ?? CUSTOM_ORIGIN;
}

export type JourneyPlan = {
  ok: true;
  recommendedArrivalMin: number;
  leadMin: number;
  extraLeadMin: number;
  travelMin: number;
  searchMin: number;
  walkMin: number;
  departureMin: number;
  estimatedArrivalMin: number;
  parkArrivalMin: number;
  bookingEndMin: number;
  assumptions: string[];
};

export type JourneyFailure = { ok: false; reason: string };

export function isScarce(park: ParkForecast | undefined, unmet: number): boolean {
  if (unmet > 1) return true;
  if (!park) return false;
  const band = bandFor(park);
  return band === "scarce" || band === "limited";
}

export function planJourney(input: {
  appointment: Appointment;
  origin: Origin;
  mode: Mode;
  assumptions: Assumptions;
  departmentWalkMin: number;
  parkWalkMin: number;
  scarce: boolean;
  shiftAccepted: boolean;
}): JourneyPlan | JourneyFailure {
  const travel = input.origin.minutes[input.mode];
  if (travel == null) {
    return {
      ok: false,
      reason: `${MODE_LABEL[input.mode]} is not in the simulated times for ${input.origin.label}. Pick another mode or a preset place.`,
    };
  }

  const extraLeadMin = input.mode === "car" && input.scarce ? 10 : 0;
  const leadMin = input.assumptions.arrivalLeadMin + extraLeadMin;
  let recommendedArrivalMin = input.appointment.startMin - leadMin;
  if (input.shiftAccepted && input.appointment.approvedShiftMin > 0) {
    recommendedArrivalMin = Math.min(
      input.appointment.startMin - 5,
      recommendedArrivalMin + input.appointment.approvedShiftMin,
    );
  }

  const department = departmentById(input.appointment.departmentId);
  let walkMin = input.departmentWalkMin;
  let searchMin = 0;
  if (input.mode === "car") {
    walkMin = input.parkWalkMin + department.extraWalkMin;
    if (input.scarce) searchMin = 8;
    else searchMin = 3;
  } else if (input.mode === "bus" || input.mode === "train") {
    walkMin = 4 + department.extraWalkMin;
  } else if (input.mode === "cycle") {
    walkMin = 2 + department.extraWalkMin;
  } else {
    walkMin = input.origin.minutes.walk != null ? department.extraWalkMin : input.departmentWalkMin;
  }

  const departureMin = recommendedArrivalMin - travel - searchMin - walkMin;
  const estimatedArrivalMin = departureMin + travel + searchMin + walkMin;
  const parkArrivalMin = input.mode === "car" ? estimatedArrivalMin - walkMin : estimatedArrivalMin;
  const bookingEndMin =
    input.appointment.startMin +
    input.appointment.durationMin +
    input.appointment.delayMin +
    input.assumptions.overrunMin;

  const assumptions = [
    "Journey times are fixed weekday-morning illustrations. They are not a live traffic feed.",
    `The arrival buffer is ${leadMin} minutes before the appointment: ${input.assumptions.arrivalLeadMin} minutes to reach the department and settle,${extraLeadMin ? ` plus ${extraLeadMin} minutes because a space looks harder to find,` : ""} with no second hidden buffer.`,
    input.mode === "car"
      ? `Finding a bay is simulated as ${searchMin} minutes. Walking on is ${walkMin} minutes, including the clinic wing.`
      : "This mode does not use a hospital parking bay.",
    `A parking hold, when used, runs until the booked slot ends, plus ${input.appointment.delayMin} minutes of reported clinic delay, plus a ${input.assumptions.overrunMin} minute overrun allowance.`,
    input.origin.id === "custom"
      ? "A typed place uses one generic simulated duration. It is not geocoded."
      : "Preset places use one simulated duration each. They are not route plans.",
  ];

  return {
    ok: true,
    recommendedArrivalMin,
    leadMin,
    extraLeadMin,
    travelMin: travel,
    searchMin,
    walkMin,
    departureMin,
    estimatedArrivalMin,
    parkArrivalMin,
    bookingEndMin,
    assumptions,
  };
}
