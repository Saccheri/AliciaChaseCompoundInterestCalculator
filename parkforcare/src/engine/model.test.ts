import { describe, expect, it } from "vitest";
import { BAYS } from "../data/campus";
import { buildAppointments, focusForDate } from "../data/schedules";
import { scenarioById } from "../data/scenarios";
import { managementAdvice } from "./advice";
import { buildDaySeries, evaluateMoment, parkingWindow } from "./forecast";
import { planJourney, originById } from "./journey";
import { bayIsFree, shortageSeeds, tryMove, tryReserve } from "./reservations";

describe("schedules", () => {
  it("places each persona on the stated clinic time", () => {
    expect(focusForDate("2026-11-17")).toMatchObject({
      patientName: "Jordan Hale",
      startMin: 10 * 60 + 30,
      departmentId: "cardio",
      delayMin: 0,
      approvedShiftMin: 0,
    });
    expect(focusForDate("2026-11-18")).toMatchObject({
      patientName: "Alex Okonkwo",
      startMin: 9 * 60 + 15,
    });
    expect(focusForDate("2026-11-19")).toMatchObject({
      patientName: "Samira Begum",
      startMin: 10 * 60,
      delayMin: 45,
      approvedShiftMin: 20,
    });
  });
});

describe("forecast", () => {
  it("keeps a normal morning inside hospital capacity and leaves accessible bays unused", () => {
    const scenario = scenarioById("normal");
    const moment = evaluateMoment({
      date: scenario.date,
      minute: 10 * 60 + 30,
      appointments: buildAppointments(scenario.date),
      assumptions: scenario.assumptions,
      reservations: [],
    });
    expect(moment.unmet).toBe(0);
    expect(moment.hospitalUtil).toBeLessThan(0.85);
    expect(moment.hospitalUtil).toBeGreaterThan(0.4);
    const chapel = moment.parks.find((p) => p.park.id === "chapel");
    expect(chapel?.predictedOccupied).toBe(0);
    expect(chapel?.generalCapacity).toBe(0);
  });

  it("puts the shortage day over capacity and records unmet demand", () => {
    const scenario = scenarioById("shortage");
    const moment = evaluateMoment({
      date: scenario.date,
      minute: 10 * 60,
      appointments: buildAppointments(scenario.date),
      assumptions: scenario.assumptions,
      reservations: shortageSeeds(scenario.date),
    });
    expect(moment.hospitalUtil).toBeGreaterThan(0.95);
    expect(moment.unmet).toBeGreaterThan(10);
    const horizon = moment.parks.find((p) => p.park.id === "horizon");
    expect(horizon?.capacity).toBeCloseTo(190, 5);
    const series = buildDaySeries({
      date: scenario.date,
      appointments: buildAppointments(scenario.date),
      assumptions: scenario.assumptions,
      reservations: shortageSeeds(scenario.date),
    });
    expect(managementAdvice(moment, series)[0]?.level).toBe("critical");
    expect(horizon?.bookableGeneralLeft).toBe(0);
    const riverside = moment.parks.find((p) => p.park.id === "riverside");
    expect(riverside?.bookableGeneralLeft).toBeGreaterThan(0);
  });

  it("holds delayed respiratory cars for longer than the booked slot", () => {
    const appointment = focusForDate("2026-11-19");
    expect(appointment).not.toBeNull();
    const window = parkingWindow(appointment!, scenarioById("delay").assumptions);
    expect(window.end - appointment!.startMin).toBe(30 + 45 + 20);
  });
});

describe("reservations", () => {
  const date = "2026-11-17";
  const base = {
    reservations: [] as ReturnType<typeof shortageSeeds>,
    parkId: "horizon",
    date,
    startMin: 9 * 60 + 40,
    endMin: 11 * 60 + 30,
    appointmentRef: "PFC-17-1030",
    needsAccessible: false,
    id: "r1",
  };

  it("refuses a second hold on the same bay and the same appointment", () => {
    const first = tryReserve(base);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(
      bayIsFree([first.reservation], first.reservation.bayId, date, base.startMin, base.endMin),
    ).toBe(false);
    const second = tryReserve({ ...base, id: "r2", reservations: [first.reservation] });
    expect(second.ok).toBe(false);
  });

  it("does not offer Chapel Court as a general bay", () => {
    const result = tryReserve({ ...base, parkId: "chapel" });
    expect(result.ok).toBe(false);
  });

  it("offers an accessible bay only when asked, and keeps it off the general pool", () => {
    const taken = tryReserve({ ...base, needsAccessible: true, parkId: "chapel" });
    expect(taken.ok).toBe(true);
    if (!taken.ok) return;
    expect(taken.reservation.kind).toBe("accessible");
    const general = tryReserve({
      ...base,
      id: "other",
      appointmentRef: "PFC-OTHER-2",
      parkId: "chapel",
      needsAccessible: false,
      reservations: [taken.reservation],
    });
    expect(general.ok).toBe(false);
  });

  it("blocks a move that would collide, and allows a free extension", () => {
    const first = tryReserve(base);
    const other = tryReserve({
      ...base,
      id: "other",
      appointmentRef: "PFC-OTHER-2",
      startMin: 11 * 60 + 30,
      endMin: 13 * 60,
    });
    expect(first.ok && other.ok).toBe(true);
    if (!first.ok || !other.ok) return;
    const clash = tryMove({
      reservations: [first.reservation, other.reservation],
      reservationId: first.reservation.id,
      startMin: first.reservation.startMin,
      endMin: 12 * 60,
    });
    expect(clash.ok).toBe(false);
    const extended = tryMove({
      reservations: [first.reservation],
      reservationId: first.reservation.id,
      startMin: first.reservation.startMin,
      endMin: first.reservation.endMin + 30,
    });
    expect(extended.ok).toBe(true);
  });

  it("fills every general hospital bookable bay in the shortage seed", () => {
    const seeds = shortageSeeds("2026-11-18");
    const generalHospital = BAYS.filter(
      (b) => (b.parkId === "horizon" || b.parkId === "garden") && b.kind === "general",
    );
    expect(seeds).toHaveLength(generalHospital.length);
    const attempt = tryReserve({
      ...base,
      date: "2026-11-18",
      reservations: seeds,
      startMin: 9 * 60,
      endMin: 11 * 60,
    });
    expect(attempt.ok).toBe(false);
    const riverside = tryReserve({
      ...base,
      date: "2026-11-18",
      parkId: "riverside",
      reservations: seeds,
      startMin: 9 * 60,
      endMin: 11 * 60,
    });
    expect(riverside.ok).toBe(true);
  });
});

describe("journey", () => {
  it("does not move the recommended arrival unless the clinic instruction is accepted", () => {
    const appointment = focusForDate("2026-11-19")!;
    const assumptions = scenarioById("delay").assumptions;
    const shared = {
      appointment,
      origin: originById("clifton"),
      mode: "car" as const,
      assumptions,
      departmentWalkMin: 4,
      parkWalkMin: 4,
      scarce: false,
    };
    const before = planJourney({ ...shared, shiftAccepted: false });
    const after = planJourney({ ...shared, shiftAccepted: true });
    expect(before.ok && after.ok).toBe(true);
    if (!before.ok || !after.ok) return;
    expect(before.recommendedArrivalMin).toBe(appointment.startMin - 25);
    expect(after.recommendedArrivalMin - before.recommendedArrivalMin).toBe(20);
    expect(after.recommendedArrivalMin).toBeLessThan(appointment.startMin);
    const capped = planJourney({
      ...shared,
      shiftAccepted: true,
      appointment: { ...appointment, approvedShiftMin: 90 },
    });
    expect(capped.ok).toBe(true);
    if (capped.ok) expect(capped.recommendedArrivalMin).toBe(appointment.startMin - 5);
    expect(before.departureMin).toBeLessThan(before.recommendedArrivalMin);
    expect(before.estimatedArrivalMin).toBe(before.recommendedArrivalMin);
  });
});
