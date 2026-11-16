import type { Appointment } from "../engine/types";

type Block = {
  departmentId: string;
  from: number;
  until: number;
  every: number;
  duration: number;
  delayMin?: number;
};

type Focus = {
  departmentId: string;
  startMin: number;
  name: string;
  reference: string;
  approvedShiftMin: number;
};

type DaySpec = {
  label: string;
  tone: string;
  blocks: Block[];
  focus?: Focus;
};

const h = (hour: number, minute = 0) => hour * 60 + minute;

const NORMAL_MORNING: Block[] = [
  { departmentId: "cardio", from: h(8, 30), until: h(12, 30), every: 10, duration: 35 },
  { departmentId: "resp", from: h(8, 0), until: h(12, 20), every: 10, duration: 30 },
  { departmentId: "ortho", from: h(8, 15), until: h(12, 30), every: 15, duration: 40 },
  { departmentId: "ent", from: h(9, 0), until: h(12, 0), every: 10, duration: 20 },
  { departmentId: "eye", from: h(8, 40), until: h(12, 20), every: 10, duration: 25 },
  { departmentId: "gynae", from: h(9, 10), until: h(12, 10), every: 12, duration: 30 },
];

const NORMAL_AFTERNOON: Block[] = [
  { departmentId: "derm", from: h(13, 0), until: h(16, 0), every: 12, duration: 20 },
  { departmentId: "surg", from: h(13, 10), until: h(16, 10), every: 12, duration: 30 },
  { departmentId: "eye", from: h(13, 20), until: h(15, 40), every: 15, duration: 25 },
];

const SURGE_MORNING: Block[] = [
  { departmentId: "cardio", from: h(8, 0), until: h(12, 0), every: 5, duration: 35 },
  { departmentId: "resp", from: h(8, 0), until: h(12, 0), every: 5, duration: 30 },
  { departmentId: "ortho", from: h(8, 0), until: h(12, 0), every: 5, duration: 40 },
  { departmentId: "ent", from: h(8, 5), until: h(12, 0), every: 5, duration: 20 },
  { departmentId: "eye", from: h(8, 0), until: h(12, 0), every: 5, duration: 25 },
  { departmentId: "gynae", from: h(8, 5), until: h(12, 0), every: 5, duration: 30 },
  { departmentId: "derm", from: h(8, 10), until: h(11, 40), every: 5, duration: 20 },
  { departmentId: "surg", from: h(8, 10), until: h(11, 40), every: 5, duration: 30 },
];

export const DAYS: Record<string, DaySpec> = {
  "2026-11-17": {
    label: "Tue 17 Nov",
    tone: "Typical clinics",
    blocks: [...NORMAL_MORNING, ...NORMAL_AFTERNOON],
    focus: {
      departmentId: "cardio",
      startMin: h(10, 30),
      name: "Jordan Hale",
      reference: "PFC-17-1030",
      approvedShiftMin: 0,
    },
  },
  "2026-11-18": {
    label: "Wed 18 Nov",
    tone: "Extra morning lists",
    blocks: [
      ...SURGE_MORNING,
      { departmentId: "derm", from: h(13, 0), until: h(16, 0), every: 8, duration: 20 },
      { departmentId: "surg", from: h(13, 0), until: h(16, 0), every: 8, duration: 30 },
      { departmentId: "ortho", from: h(13, 15), until: h(16, 0), every: 10, duration: 40 },
    ],
    focus: {
      departmentId: "ortho",
      startMin: h(9, 15),
      name: "Alex Okonkwo",
      reference: "PFC-18-0915",
      approvedShiftMin: 0,
    },
  },
  "2026-11-19": {
    label: "Thu 19 Nov",
    tone: "Respiratory list delayed",
    blocks: [
      { departmentId: "cardio", from: h(8, 30), until: h(12, 30), every: 10, duration: 35 },
      { departmentId: "resp", from: h(8, 0), until: h(12, 20), every: 10, duration: 30, delayMin: 45 },
      { departmentId: "ortho", from: h(8, 15), until: h(12, 30), every: 15, duration: 40 },
      { departmentId: "ent", from: h(9, 0), until: h(12, 0), every: 10, duration: 20 },
      { departmentId: "eye", from: h(8, 40), until: h(12, 20), every: 10, duration: 25 },
      { departmentId: "gynae", from: h(9, 10), until: h(12, 10), every: 12, duration: 30 },
      ...NORMAL_AFTERNOON,
    ],
    focus: {
      departmentId: "resp",
      startMin: h(10, 0),
      name: "Samira Begum",
      reference: "PFC-19-1000",
      approvedShiftMin: 20,
    },
  },
  "2026-11-20": {
    label: "Fri 20 Nov",
    tone: "Quieter list",
    blocks: [
      { departmentId: "cardio", from: h(9, 0), until: h(12, 0), every: 15, duration: 35 },
      { departmentId: "derm", from: h(9, 20), until: h(12, 20), every: 15, duration: 20 },
      { departmentId: "eye", from: h(13, 0), until: h(15, 30), every: 15, duration: 25 },
    ],
  },
};

export const DATE_OPTIONS = Object.entries(DAYS).map(([date, spec]) => ({
  date,
  label: spec.label,
  tone: spec.tone,
}));

export function buildAppointments(date: string): Appointment[] {
  const spec = DAYS[date];
  if (!spec) return [];
  const list: Appointment[] = [];
  for (const block of spec.blocks) {
    for (let t = block.from; t < block.until; t += block.every) {
      const isFocus = spec.focus?.departmentId === block.departmentId && spec.focus.startMin === t;
      list.push({
        id: `${date}-${block.departmentId}-${t}`,
        date,
        patientName: isFocus && spec.focus ? spec.focus.name : "Clinic list",
        departmentId: block.departmentId,
        startMin: t,
        durationMin: block.duration,
        delayMin: block.delayMin ?? 0,
        approvedShiftMin: isFocus && spec.focus ? spec.focus.approvedShiftMin : 0,
        reference: isFocus && spec.focus ? spec.focus.reference : `LIST-${block.departmentId.toUpperCase()}`,
      });
    }
  }
  if (spec.focus) {
    const found = list.some((a) => a.reference === spec.focus?.reference);
    if (!found) {
      throw new Error(`Focus appointment ${spec.focus.reference} is not on ${date}`);
    }
  }
  return list;
}

export function focusForDate(date: string): Appointment | null {
  const spec = DAYS[date];
  if (!spec?.focus) return null;
  return buildAppointments(date).find((a) => a.reference === spec.focus?.reference) ?? null;
}
