import { BAYS, PARKS, type CarPark } from "../data/campus";
import { DAY_END, DAY_START, SLOT, formatTime, interpolate } from "./time";
import type { Appointment, Assumptions, Reservation } from "./types";

/**
 * Deterministic parking simulation.
 *
 * Expected vehicles = staff profile + visitor profile + appointment-driven cars.
 * A listed outpatient contributes carModeShare × demandMultiplier of a car.
 * That car is present from arrivalLeadMin before the appointment until the
 * booked duration, plus any clinic delay, plus overrunMin.
 *
 * General demand never occupies accessible spaces.
 * About 15% of vehicles try Garden Surface first. The rest try Horizon,
 * then the remaining hospital spaces, then Riverside. Anything left is unmet.
 * North Park & Ride is not part of this fill. It is offered as a travel alternative.
 *
 * Confirmed reservations are a separate ledger. They are not added on top of
 * the vehicle forecast, because that forecast already expects patients who drive.
 */

const STAFF: readonly [number, number][] = [
  [6 * 60, 28],
  [7 * 60, 80],
  [8 * 60, 150],
  [9 * 60, 185],
  [10 * 60, 198],
  [11 * 60, 194],
  [12 * 60, 160],
  [13 * 60, 178],
  [14 * 60, 188],
  [15 * 60, 184],
  [16 * 60, 150],
  [17 * 60, 96],
  [18 * 60, 48],
  [19 * 60, 30],
  [20 * 60, 18],
];

const VISITORS: readonly [number, number][] = [
  [6 * 60, 4],
  [8 * 60, 12],
  [9 * 60, 22],
  [10 * 60, 32],
  [11 * 60, 38],
  [12 * 60, 36],
  [14 * 60, 30],
  [16 * 60, 18],
  [18 * 60, 8],
  [20 * 60, 4],
];

export type ParkForecast = {
  park: CarPark;
  capacity: number;
  accessible: number;
  generalCapacity: number;
  predictedOccupied: number;
  generalFree: number;
  reserved: number;
  bookableGeneralLeft: number;
  bookableAccessibleLeft: number;
};

export type MomentForecast = {
  minute: number;
  staff: number;
  visitors: number;
  patientCars: number;
  expectedVehicles: number;
  occupancy: number;
  capacity: number;
  available: number;
  unmet: number;
  reserved: number;
  hospitalOccupied: number;
  hospitalGeneralCapacity: number;
  hospitalUtil: number;
  /** General spaces only. Accessible bays are excluded so the chart can cross this line. */
  generalCapacity: number;
  parks: ParkForecast[];
};

export type SlotForecast = MomentForecast & {
  label: string;
  arrivals: number;
  departures: number;
};

export type AvailabilityBand = "plenty" | "limited" | "scarce" | "protected" | "alternative-travel";

export function bandFor(park: ParkForecast): AvailabilityBand {
  if (park.park.kind === "park-ride") return "alternative-travel";
  if (park.generalCapacity <= 0) return "protected";
  const freeRatio = park.generalFree / park.generalCapacity;
  if (freeRatio >= 0.25) return "plenty";
  if (freeRatio >= 0.1) return "limited";
  return "scarce";
}

export function bandLabel(band: AvailabilityBand): string {
  switch (band) {
    case "plenty":
      return "Plenty";
    case "limited":
      return "Limited";
    case "scarce":
      return "Scarce";
    case "protected":
      return "Protected";
    case "alternative-travel":
      return "Bus link";
  }
}

function activeOnDate(reservations: Reservation[], date: string): Reservation[] {
  return reservations.filter((r) => r.status === "confirmed" && r.date === date);
}

function overlapsMinute(r: Reservation, minute: number): boolean {
  return r.startMin <= minute && minute < r.endMin;
}

export function effectiveSpaces(park: CarPark, assumptions: Assumptions): {
  capacity: number;
  accessible: number;
  generalCapacity: number;
} {
  const open = park.id === "horizon" ? assumptions.horizonOpenFactor : 1;
  const capacity = park.capacity * open;
  const accessible = park.accessible * open;
  return {
    capacity,
    accessible,
    generalCapacity: Math.max(0, capacity - accessible),
  };
}

export function parkingWindow(appointment: Appointment, assumptions: Assumptions): {
  start: number;
  end: number;
} {
  return {
    start: appointment.startMin - assumptions.arrivalLeadMin,
    end:
      appointment.startMin +
      appointment.durationMin +
      appointment.delayMin +
      assumptions.overrunMin,
  };
}

function patientCarsAt(
  appointments: Appointment[],
  date: string,
  minute: number,
  assumptions: Assumptions,
): number {
  let cars = 0;
  const weight = assumptions.carModeShare * assumptions.demandMultiplier;
  for (const appointment of appointments) {
    if (appointment.date !== date) continue;
    const window = parkingWindow(appointment, assumptions);
    if (minute >= window.start && minute < window.end) cars += weight;
  }
  return cars;
}

function flowBetween(
  appointments: Appointment[],
  date: string,
  from: number,
  to: number,
  assumptions: Assumptions,
): { arrivals: number; departures: number } {
  const weight = assumptions.carModeShare * assumptions.demandMultiplier;
  let arrivals = 0;
  let departures = 0;
  for (const appointment of appointments) {
    if (appointment.date !== date) continue;
    const window = parkingWindow(appointment, assumptions);
    if (window.start >= from && window.start < to) arrivals += weight;
    if (window.end >= from && window.end < to) departures += weight;
  }
  const staff0 = interpolate(STAFF, from) * assumptions.staffScale;
  const staff1 = interpolate(STAFF, to) * assumptions.staffScale;
  const vis0 = interpolate(VISITORS, from) * assumptions.visitorScale;
  const vis1 = interpolate(VISITORS, to) * assumptions.visitorScale;
  const staffDelta = staff1 - staff0;
  const visDelta = vis1 - vis0;
  arrivals += Math.max(0, staffDelta) + Math.max(0, visDelta);
  departures += Math.max(0, -staffDelta) + Math.max(0, -visDelta);
  return { arrivals, departures };
}

function bookableLeft(
  parkId: string,
  kind: "general" | "accessible",
  reservations: Reservation[],
  minute: number,
): number {
  const pool = BAYS.filter((b) => b.parkId === parkId && b.kind === kind);
  const held = new Set(
    reservations.filter((r) => r.parkId === parkId && r.kind === kind && overlapsMinute(r, minute)).map((r) => r.bayId),
  );
  return pool.filter((b) => !held.has(b.id)).length;
}

export function evaluateMoment(input: {
  date: string;
  minute: number;
  appointments: Appointment[];
  assumptions: Assumptions;
  reservations: Reservation[];
}): MomentForecast {
  const { date, minute, appointments, assumptions } = input;
  const reservations = activeOnDate(input.reservations, date);
  const staff = interpolate(STAFF, minute) * assumptions.staffScale;
  const visitors = interpolate(VISITORS, minute) * assumptions.visitorScale;
  const patientCars = patientCarsAt(appointments, date, minute, assumptions);
  const expectedVehicles = staff + visitors + patientCars;

  const spaces = Object.fromEntries(
    PARKS.map((park) => [park.id, effectiveSpaces(park, assumptions)]),
  ) as Record<string, ReturnType<typeof effectiveSpaces>>;

  const gardenCap = spaces.garden.generalCapacity;
  const horizonCap = spaces.horizon.generalCapacity;
  const riversideCap = spaces.riverside.generalCapacity;

  let garden = Math.min(gardenCap, expectedVehicles * 0.15);
  let left = expectedVehicles - garden;
  const horizon = Math.min(horizonCap, left);
  left -= horizon;
  const gardenExtra = Math.min(gardenCap - garden, left);
  garden += gardenExtra;
  left -= gardenExtra;
  const riverside = Math.min(riversideCap, left);
  left -= riverside;
  const unmet = left;

  const occupiedByPark: Record<string, number> = {
    horizon,
    garden,
    chapel: 0,
    riverside,
    "north-ride": 0,
  };

  const parks: ParkForecast[] = PARKS.map((park) => {
    const spec = spaces[park.id];
    const predictedOccupied = occupiedByPark[park.id] ?? 0;
    const reserved = reservations.filter((r) => r.parkId === park.id && overlapsMinute(r, minute)).length;
    return {
      park,
      capacity: spec.capacity,
      accessible: spec.accessible,
      generalCapacity: spec.generalCapacity,
      predictedOccupied,
      generalFree: Math.max(0, spec.generalCapacity - predictedOccupied),
      reserved,
      bookableGeneralLeft: bookableLeft(park.id, "general", reservations, minute),
      bookableAccessibleLeft: bookableLeft(park.id, "accessible", reservations, minute),
    };
  });

  const kpiParks = parks.filter((p) => p.park.kind !== "park-ride");
  const capacity = kpiParks.reduce((sum, p) => sum + p.capacity, 0);
  const occupancy = kpiParks.reduce((sum, p) => sum + p.predictedOccupied, 0);
  const hospitalParks = parks.filter((p) => p.park.id === "horizon" || p.park.id === "garden");
  const hospitalOccupied = hospitalParks.reduce((sum, p) => sum + p.predictedOccupied, 0);
  const hospitalGeneralCapacity = hospitalParks.reduce((sum, p) => sum + p.generalCapacity, 0);

  return {
    minute,
    staff,
    visitors,
    patientCars,
    expectedVehicles,
    occupancy,
    capacity,
    available: Math.max(0, capacity - occupancy),
    unmet,
    reserved: reservations.filter((r) => overlapsMinute(r, minute)).length,
    hospitalOccupied,
    hospitalGeneralCapacity,
    hospitalUtil: hospitalGeneralCapacity === 0 ? 0 : hospitalOccupied / hospitalGeneralCapacity,
    generalCapacity: kpiParks.reduce((sum, p) => sum + p.generalCapacity, 0),
    parks,
  };
}

export function buildDaySeries(input: {
  date: string;
  appointments: Appointment[];
  assumptions: Assumptions;
  reservations: Reservation[];
}): SlotForecast[] {
  const slots: SlotForecast[] = [];
  for (let minute = DAY_START; minute < DAY_END; minute += SLOT) {
    const moment = evaluateMoment({ ...input, minute });
    const flow = flowBetween(input.appointments, input.date, minute, minute + SLOT, input.assumptions);
    slots.push({
      ...moment,
      label: formatTime(minute),
      arrivals: flow.arrivals,
      departures: flow.departures,
    });
  }
  return slots;
}

export function peakSlot(slots: SlotForecast[]): SlotForecast {
  return slots.reduce((best, slot) => (slot.occupancy > best.occupancy ? slot : best));
}
