import {
  createContext,
  useContext,
  useMemo,
  useReducer,
  type ReactNode,
} from "react";
import { DESK, departmentById, parkById } from "../data/campus";
import { buildAppointments, focusForDate } from "../data/schedules";
import { scenarioById, SCENARIOS, type Scenario } from "../data/scenarios";
import type { ScenarioId } from "../data/scenario-ids";
import { managementAdvice, MODEL_NOTES, type Advice } from "../engine/advice";
import {
  buildDaySeries,
  evaluateMoment,
  type MomentForecast,
  type SlotForecast,
} from "../engine/forecast";
import {
  CUSTOM_ORIGIN,
  isScarce,
  originById,
  planJourney,
  type JourneyPlan,
  type Mode,
  type Origin,
} from "../engine/journey";
import { activeReservations, delaySeed, shortageSeeds, tryMove, tryReserve } from "../engine/reservations";
import type { Appointment, Assumptions, LedgerEvent, Reservation } from "../engine/types";

export type Tab = "appointment" | "parking" | "journey" | "alerts";
export type AppView = "patient" | "hospital";

type State = {
  scenarioId: ScenarioId;
  view: AppView;
  tab: Tab;
  assumptions: Assumptions;
  dashboardDate: string;
  inspectMin: number;
  originId: string;
  customOrigin: string;
  mode: Mode;
  needsAccessible: boolean;
  selectedParkId: string | null;
  reservations: Reservation[];
  shiftAccepted: boolean;
  events: LedgerEvent[];
  message: string | null;
};

type Action =
  | { type: "scenario"; id: ScenarioId }
  | { type: "reset" }
  | { type: "view"; view: AppView }
  | { type: "tab"; tab: Tab }
  | { type: "assumptions"; patch: Partial<Assumptions> }
  | { type: "date"; date: string }
  | { type: "inspect"; minute: number }
  | { type: "origin"; id: string }
  | { type: "custom-origin"; text: string }
  | { type: "mode"; mode: Mode }
  | { type: "accessible"; value: boolean }
  | { type: "select-park"; id: string }
  | { type: "shift"; accepted: boolean }
  | { type: "message"; message: string | null }
  | { type: "put"; reservation: Reservation; event: LedgerEvent }
  | { type: "cancel"; id: string; event: LedgerEvent };

function openingEvents(scenarioId: ScenarioId, reservations: Reservation[]): LedgerEvent[] {
  if (scenarioId === "shortage") {
    return [
      {
        id: "open-shortage",
        title: "Other clinic holds loaded",
        detail: `${reservations.length} bookable hospital bays are already held from 07:30 to 13:30. Riverside is not in that batch.`,
      },
    ];
  }
  if (scenarioId === "delay") {
    return [
      {
        id: "open-delay",
        title: "Bay already held",
        detail: "Horizon Multi-Storey has a confirmed hold for Samira Begum, covering the delayed clinic and the overrun allowance.",
      },
    ];
  }
  return [
    {
      id: "open-normal",
      title: "No holds yet",
      detail: "A reservation made on the patient screen will reduce the bookable bays and appear in this log.",
    },
  ];
}

function delayReservation(scenario: Scenario): Reservation[] {
  const focus = focusForDate(scenario.date);
  if (!focus) return [];
  const assumptions = scenario.assumptions;
  const appointments = buildAppointments(scenario.date);
  const probeMin = focus.startMin - assumptions.arrivalLeadMin;
  const probe = evaluateMoment({
    date: scenario.date,
    minute: probeMin,
    appointments,
    assumptions,
    reservations: [],
  });
  const horizon = probe.parks.find((p) => p.park.id === "horizon");
  const plan = planJourney({
    appointment: focus,
    origin: originById(scenario.originId),
    mode: "car",
    assumptions,
    departmentWalkMin: departmentById(focus.departmentId).extraWalkMin,
    parkWalkMin: horizon?.park.walkMin ?? 4,
    scarce: isScarce(horizon, probe.unmet),
    shiftAccepted: false,
  });
  if (!plan.ok) return [];
  return [
    delaySeed({
      date: scenario.date,
      startMin: Math.round(plan.parkArrivalMin),
      endMin: Math.round(plan.bookingEndMin),
      appointmentRef: focus.reference,
    }),
  ];
}

function fresh(scenarioId: ScenarioId, view: AppView, tab: Tab): State {
  const scenario = scenarioById(scenarioId);
  const reservations =
    scenarioId === "shortage"
      ? shortageSeeds(scenario.date)
      : scenarioId === "delay"
        ? delayReservation(scenario)
        : [];
  return {
    scenarioId,
    view,
    tab,
    assumptions: { ...scenario.assumptions },
    dashboardDate: scenario.date,
    inspectMin: scenario.deskMin ?? scenario.nowMin,
    originId: scenario.originId,
    customOrigin: "",
    mode: "car",
    needsAccessible: false,
    selectedParkId: null,
    reservations,
    shiftAccepted: false,
    events: openingEvents(scenarioId, reservations),
    message: null,
  };
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "scenario":
      return fresh(action.id, state.view, state.tab);
    case "reset":
      return fresh(state.scenarioId, state.view, state.tab);
    case "view":
      return { ...state, view: action.view, message: null };
    case "tab":
      return { ...state, tab: action.tab };
    case "assumptions":
      return { ...state, assumptions: { ...state.assumptions, ...action.patch } };
    case "date":
      return { ...state, dashboardDate: action.date };
    case "inspect":
      return { ...state, inspectMin: action.minute };
    case "origin":
      return { ...state, originId: action.id, customOrigin: "" };
    case "custom-origin":
      return { ...state, customOrigin: action.text };
    case "mode":
      return { ...state, mode: action.mode };
    case "accessible":
      return { ...state, needsAccessible: action.value, selectedParkId: state.selectedParkId };
    case "select-park":
      return { ...state, selectedParkId: action.id, message: null };
    case "shift":
      return { ...state, shiftAccepted: action.accepted, message: null };
    case "message":
      return { ...state, message: action.message };
    case "put":
      return {
        ...state,
        message: null,
        reservations: [
          action.reservation,
          ...state.reservations.filter((r) => r.id !== action.reservation.id),
        ],
        events: [action.event, ...state.events].slice(0, 12),
      };
    case "cancel":
      return {
        ...state,
        message: null,
        reservations: state.reservations.map((r) =>
          r.id === action.id ? { ...r, status: "cancelled" } : r,
        ),
        events: [action.event, ...state.events].slice(0, 12),
      };
    default:
      return state;
  }
}

export type Sim = {
  scenario: Scenario;
  scenarios: Scenario[];
  view: AppView;
  tab: Tab;
  assumptions: Assumptions;
  dashboardDate: string;
  inspectMin: number;
  originId: string;
  customOrigin: string;
  origin: Origin;
  mode: Mode;
  needsAccessible: boolean;
  selectedParkId: string | null;
  reservations: Reservation[];
  shiftAccepted: boolean;
  events: LedgerEvent[];
  message: string | null;
  focus: Appointment;
  departmentName: string;
  nowMoment: MomentForecast;
  arrivalMoment: MomentForecast;
  plan: JourneyPlan | { ok: false; reason: string };
  series: SlotForecast[];
  inspect: MomentForecast;
  advice: Advice[];
  mine: Reservation | undefined;
  desk: typeof DESK;
  modelNotes: string[];
  setScenario: (id: ScenarioId) => void;
  resetScenario: () => void;
  setView: (view: AppView) => void;
  setTab: (tab: Tab) => void;
  patchAssumptions: (patch: Partial<Assumptions>) => void;
  resetAssumptions: () => void;
  setDate: (date: string) => void;
  setInspect: (minute: number) => void;
  setOrigin: (id: string) => void;
  setCustomOrigin: (text: string) => void;
  setMode: (mode: Mode) => void;
  setAccessible: (value: boolean) => void;
  selectPark: (id: string) => void;
  setShift: (accepted: boolean) => void;
  clearMessage: () => void;
  reserve: () => void;
  cancelHold: () => void;
  extendHold: () => void;
  shiftHold: () => void;
};

const Ctx = createContext<Sim | null>(null);

export function SimulationProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, () => fresh("normal", "patient", "appointment"));

  const value = useMemo<Sim>(() => {
    const scenario = scenarioById(state.scenarioId);
    const focus = focusForDate(scenario.date);
    if (!focus) throw new Error("Scenario date has no patient appointment");
    const patientAppointments = buildAppointments(scenario.date);
    const dashboardAppointments = buildAppointments(state.dashboardDate);
    const sharedPatient = {
      date: scenario.date,
      appointments: patientAppointments,
      assumptions: state.assumptions,
      reservations: state.reservations,
    };
    const nowMoment = evaluateMoment({ ...sharedPatient, minute: scenario.nowMin });
    const baseArrival = focus.startMin - state.assumptions.arrivalLeadMin;
    const probe = evaluateMoment({ ...sharedPatient, minute: baseArrival });
    const selected = state.selectedParkId ? parkById(state.selectedParkId) : null;
    const drivingId = selected && selected.kind !== "park-ride" ? selected.id : "horizon";
    const driving = probe.parks.find((p) => p.park.id === drivingId);
    const origin = state.customOrigin.trim()
      ? { ...CUSTOM_ORIGIN, label: state.customOrigin.trim() }
      : originById(state.originId);
    const scarce = isScarce(driving, probe.unmet);
    const plan = planJourney({
      appointment: focus,
      origin,
      mode: state.mode,
      assumptions: state.assumptions,
      departmentWalkMin: departmentById(focus.departmentId).extraWalkMin,
      parkWalkMin: driving?.park.walkMin ?? 4,
      scarce,
      shiftAccepted: state.shiftAccepted,
    });
    const arrivalMinute = plan.ok ? plan.recommendedArrivalMin : baseArrival;
    const arrivalMoment = evaluateMoment({ ...sharedPatient, minute: arrivalMinute });
    const series = buildDaySeries({
      date: state.dashboardDate,
      appointments: dashboardAppointments,
      assumptions: state.assumptions,
      reservations: state.reservations,
    });
    const inspect = evaluateMoment({
      date: state.dashboardDate,
      minute: state.inspectMin,
      appointments: dashboardAppointments,
      assumptions: state.assumptions,
      reservations: state.reservations,
    });
    const mine = activeReservations(state.reservations).find(
      (r) => r.appointmentRef === focus.reference && r.date === scenario.date,
    );

    const reserve = () => {
      if (!plan.ok) {
        dispatch({ type: "message", message: plan.reason });
        return;
      }
      if (!state.selectedParkId) {
        dispatch({ type: "message", message: "Choose a car park before holding a bay." });
        return;
      }
      const result = tryReserve({
        reservations: state.reservations,
        parkId: state.selectedParkId,
        date: scenario.date,
        startMin: Math.round(plan.parkArrivalMin),
        endMin: Math.round(plan.bookingEndMin),
        appointmentRef: focus.reference,
        needsAccessible: state.needsAccessible,
        id: `hold-${focus.reference}-${Math.round(plan.parkArrivalMin)}`,
      });
      if (!result.ok) {
        dispatch({ type: "message", message: result.reason });
        return;
      }
      const park = parkById(result.reservation.parkId);
      dispatch({
        type: "put",
        reservation: result.reservation,
        event: {
          id: result.reservation.id,
          title: "Bay held",
          detail: `${park.name} for ${focus.reference}. Confirmed hold, not a prediction.`,
        },
      });
    };

    const cancelHold = () => {
      if (!mine) return;
      dispatch({
        type: "cancel",
        id: mine.id,
        event: {
          id: `cancel-${mine.id}`,
          title: "Hold cancelled",
          detail: `${focus.reference} released ${mine.bayId}. The bay can be held again.`,
        },
      });
    };

    const extendHold = () => {
      if (!mine) return;
      const result = tryMove({
        reservations: state.reservations,
        reservationId: mine.id,
        startMin: mine.startMin,
        endMin: mine.endMin + 30,
      });
      if (!result.ok) {
        dispatch({ type: "message", message: result.reason });
        return;
      }
      dispatch({
        type: "put",
        reservation: result.reservation,
        event: {
          id: `extend-${mine.id}-${result.reservation.endMin}`,
          title: "Hold extended",
          detail: `${focus.reference} now ends 30 minutes later. The appointment time is unchanged.`,
        },
      });
    };

    const shiftHold = () => {
      if (!mine || !plan.ok) return;
      const nextStart = Math.round(plan.parkArrivalMin);
      if (mine.startMin >= nextStart) {
        dispatch({
          type: "message",
          message: "The bay hold already starts at or after the later arrival.",
        });
        return;
      }
      const result = tryMove({
        reservations: state.reservations,
        reservationId: mine.id,
        startMin: nextStart,
        endMin: Math.max(mine.endMin, Math.round(plan.bookingEndMin)),
      });
      if (!result.ok) {
        dispatch({ type: "message", message: result.reason });
        return;
      }
      dispatch({
        type: "put",
        reservation: result.reservation,
        event: {
          id: `shift-${mine.id}-${nextStart}`,
          title: "Hold moved later",
          detail: `${focus.reference} start moved to match the clinic instruction. The appointment on the letter is unchanged.`,
        },
      });
    };

    return {
      scenario,
      scenarios: SCENARIOS,
      view: state.view,
      tab: state.tab,
      assumptions: state.assumptions,
      dashboardDate: state.dashboardDate,
      inspectMin: state.inspectMin,
      originId: state.originId,
      customOrigin: state.customOrigin,
      origin,
      mode: state.mode,
      needsAccessible: state.needsAccessible,
      selectedParkId: state.selectedParkId,
      reservations: state.reservations,
      shiftAccepted: state.shiftAccepted,
      events: state.events,
      message: state.message,
      focus,
      departmentName: departmentById(focus.departmentId).name,
      nowMoment,
      arrivalMoment,
      plan,
      series,
      inspect,
      advice: managementAdvice(inspect, series),
      mine,
      desk: DESK,
      modelNotes: MODEL_NOTES,
      setScenario: (id) => dispatch({ type: "scenario", id }),
      resetScenario: () => dispatch({ type: "reset" }),
      setView: (view) => dispatch({ type: "view", view }),
      setTab: (tab) => dispatch({ type: "tab", tab }),
      patchAssumptions: (patch) => dispatch({ type: "assumptions", patch }),
      resetAssumptions: () =>
        dispatch({ type: "assumptions", patch: { ...scenarioById(state.scenarioId).assumptions } }),
      setDate: (date) => dispatch({ type: "date", date }),
      setInspect: (minute) => dispatch({ type: "inspect", minute }),
      setOrigin: (id) => dispatch({ type: "origin", id }),
      setCustomOrigin: (text) => dispatch({ type: "custom-origin", text }),
      setMode: (mode) => dispatch({ type: "mode", mode }),
      setAccessible: (value) => dispatch({ type: "accessible", value }),
      selectPark: (id) => dispatch({ type: "select-park", id }),
      setShift: (accepted) => dispatch({ type: "shift", accepted }),
      clearMessage: () => dispatch({ type: "message", message: null }),
      reserve,
      cancelHold,
      extendHold,
      shiftHold,
    };
  }, [state]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSim(): Sim {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useSim must be used inside SimulationProvider");
  return ctx;
}
