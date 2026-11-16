import { BAYS, baysFor, parkById } from "../data/campus";
import type { BayKind } from "../data/campus";
import type { Reservation } from "./types";

export function activeReservations(list: Reservation[]): Reservation[] {
  return list.filter((r) => r.status === "confirmed");
}

export function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd;
}

export function bayIsFree(
  list: Reservation[],
  bayId: string,
  date: string,
  startMin: number,
  endMin: number,
  ignoreId?: string,
): boolean {
  return !activeReservations(list).some(
    (r) =>
      r.id !== ignoreId &&
      r.bayId === bayId &&
      r.date === date &&
      overlaps(r.startMin, r.endMin, startMin, endMin),
  );
}

export function firstFreeBay(
  list: Reservation[],
  parkId: string,
  kind: BayKind,
  date: string,
  startMin: number,
  endMin: number,
  ignoreId?: string,
): string | null {
  const bay = baysFor(parkId, kind).find((candidate) =>
    bayIsFree(list, candidate.id, date, startMin, endMin, ignoreId),
  );
  return bay?.id ?? null;
}

export type ReserveResult =
  | { ok: true; reservation: Reservation }
  | { ok: false; reason: string };

export function tryReserve(input: {
  reservations: Reservation[];
  parkId: string;
  date: string;
  startMin: number;
  endMin: number;
  appointmentRef: string;
  needsAccessible: boolean;
  id: string;
}): ReserveResult {
  const park = parkById(input.parkId);
  if (park.kind === "park-ride" || (park.bookableGeneral === 0 && park.bookableAccessible === 0)) {
    return {
      ok: false,
      reason: "This site is a travel alternative. ParkForCare does not hold a bay here.",
    };
  }
  if (input.endMin - input.startMin < 20) {
    return { ok: false, reason: "The hold is too short. It needs at least 20 minutes." };
  }
  const existing = activeReservations(input.reservations).find(
    (r) => r.appointmentRef === input.appointmentRef && r.source === "patient",
  );
  if (existing) {
    return {
      ok: false,
      reason: "This appointment already has a bay held. Change that hold, or cancel it before choosing another.",
    };
  }
  const kind: BayKind = input.needsAccessible ? "accessible" : "general";
  if (kind === "general" && baysFor(input.parkId, "general").length === 0) {
    return {
      ok: false,
      reason: "General bays are not offered here. These spaces are kept for accessible and eligible free parking.",
    };
  }
  const bayId = firstFreeBay(
    input.reservations,
    input.parkId,
    kind,
    input.date,
    input.startMin,
    input.endMin,
  );
  if (!bayId) {
    const noun = kind === "accessible" ? "accessible bays" : "bookable bays";
    return {
      ok: false,
      reason: `Every ${noun} in ${park.name} is already held for that time. Try another car park.`,
    };
  }
  return {
    ok: true,
    reservation: {
      id: input.id,
      bayId,
      parkId: input.parkId,
      date: input.date,
      startMin: input.startMin,
      endMin: input.endMin,
      appointmentRef: input.appointmentRef,
      kind,
      status: "confirmed",
      source: "patient",
    },
  };
}

export function tryMove(input: {
  reservations: Reservation[];
  reservationId: string;
  startMin: number;
  endMin: number;
}): ReserveResult {
  const current = input.reservations.find((r) => r.id === input.reservationId && r.status === "confirmed");
  if (!current) return { ok: false, reason: "That hold is no longer active." };
  if (input.endMin - input.startMin < 20) {
    return { ok: false, reason: "The hold would become shorter than 20 minutes." };
  }
  if (!bayIsFree(input.reservations, current.bayId, current.date, input.startMin, input.endMin, current.id)) {
    return {
      ok: false,
      reason: "That bay is already held by someone else for part of the new time. Keep the current hold, or cancel and choose another bay.",
    };
  }
  return {
    ok: true,
    reservation: { ...current, startMin: input.startMin, endMin: input.endMin },
  };
}

export function shortageSeeds(date: string): Reservation[] {
  return BAYS.filter(
    (b) => (b.parkId === "horizon" || b.parkId === "garden") && b.kind === "general",
  ).map((bay) => ({
    id: `seed-${bay.id}`,
    bayId: bay.id,
    parkId: bay.parkId,
    date,
    startMin: 7 * 60 + 30,
    endMin: 13 * 60 + 30,
    appointmentRef: "PFC-OTHER",
    kind: "general" as const,
    status: "confirmed" as const,
    source: "seed" as const,
  }));
}

export function delaySeed(input: {
  date: string;
  startMin: number;
  endMin: number;
  appointmentRef: string;
}): Reservation {
  const bay = baysFor("horizon", "general")[3];
  return {
    id: "seed-focus",
    bayId: bay.id,
    parkId: bay.parkId,
    date: input.date,
    startMin: input.startMin,
    endMin: input.endMin,
    appointmentRef: input.appointmentRef,
    kind: "general",
    status: "confirmed",
    source: "patient",
  };
}
