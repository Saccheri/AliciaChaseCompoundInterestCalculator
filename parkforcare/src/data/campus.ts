export type ParkKind = "hospital" | "alternative" | "park-ride";

export type CarPark = {
  id: string;
  name: string;
  short: string;
  kind: ParkKind;
  capacity: number;
  accessible: number;
  bookableGeneral: number;
  bookableAccessible: number;
  walkMin: number;
  /** Illustrative hourly tariff. Null when the site is not charged by the hour. */
  hourly: number | null;
  priceLabel: string;
  x: number;
  y: number;
  w: number;
  h: number;
  blurb: string;
};

export type BayKind = "general" | "accessible";

export type Bay = {
  id: string;
  parkId: string;
  kind: BayKind;
  label: string;
};

export type Department = {
  id: string;
  name: string;
  wing: string;
  extraWalkMin: number;
};

export const HOSPITAL = {
  name: "Bristol Royal Infirmary",
  site: "Illustrative campus",
  note: "Fictional layout and fictional activity. Not a plan of the real hospital, and not an NHS service.",
};

export const DEPARTMENTS: Department[] = [
  { id: "cardio", name: "Cardiology outpatients", wing: "East clinics", extraWalkMin: 3 },
  { id: "resp", name: "Respiratory outpatients", wing: "South annexe", extraWalkMin: 4 },
  { id: "ortho", name: "Orthopaedic outpatients", wing: "North clinics", extraWalkMin: 5 },
  { id: "ent", name: "ENT outpatients", wing: "East clinics", extraWalkMin: 3 },
  { id: "derm", name: "Dermatology outpatients", wing: "South annexe", extraWalkMin: 4 },
  { id: "eye", name: "Ophthalmology outpatients", wing: "North clinics", extraWalkMin: 6 },
  { id: "surg", name: "General surgery outpatients", wing: "East clinics", extraWalkMin: 3 },
  { id: "gynae", name: "Gynaecology outpatients", wing: "South annexe", extraWalkMin: 4 },
];

export function departmentById(id: string): Department {
  const found = DEPARTMENTS.find((d) => d.id === id);
  if (!found) throw new Error(`Unknown department ${id}`);
  return found;
}

export const PARKS: CarPark[] = [
  {
    id: "horizon",
    name: "Horizon Multi-Storey",
    short: "Horizon",
    kind: "hospital",
    capacity: 380,
    accessible: 16,
    bookableGeneral: 24,
    bookableAccessible: 8,
    walkMin: 4,
    hourly: 3.2,
    priceLabel: "Illustrative £3.20 an hour",
    x: 46,
    y: 6,
    w: 24,
    h: 22,
    blurb: "Main hospital car park. Most drivers are assumed to try here first.",
  },
  {
    id: "garden",
    name: "Garden Surface",
    short: "Garden",
    kind: "hospital",
    capacity: 90,
    accessible: 10,
    bookableGeneral: 10,
    bookableAccessible: 4,
    walkMin: 2,
    hourly: 2.6,
    priceLabel: "Illustrative £2.60 an hour",
    x: 46,
    y: 32,
    w: 18,
    h: 18,
    blurb: "Closest surface car park to the outpatients entrance.",
  },
  {
    id: "chapel",
    name: "Chapel Court",
    short: "Chapel",
    kind: "hospital",
    capacity: 24,
    accessible: 24,
    bookableGeneral: 0,
    bookableAccessible: 12,
    walkMin: 3,
    hourly: 0,
    priceLabel: "Illustrative £0 — eligible free parking is not checked here",
    x: 8,
    y: 50,
    w: 18,
    h: 18,
    blurb: "Accessible and eligible free-parking spaces. Held out of general allocation.",
  },
  {
    id: "riverside",
    name: "Riverside Public Car Park",
    short: "Riverside",
    kind: "alternative",
    capacity: 160,
    accessible: 8,
    bookableGeneral: 16,
    bookableAccessible: 4,
    walkMin: 11,
    hourly: 1.8,
    priceLabel: "Illustrative £1.80 an hour",
    x: 72,
    y: 48,
    w: 22,
    h: 20,
    blurb: "Nearby public car park used when the hospital car parks are forecast full.",
  },
  {
    id: "north-ride",
    name: "North Park & Ride",
    short: "Park & Ride",
    kind: "park-ride",
    capacity: 800,
    accessible: 20,
    bookableGeneral: 0,
    bookableAccessible: 0,
    walkMin: 14,
    hourly: null,
    priceLabel: "Illustrative £3.50 return",
    x: 74,
    y: 8,
    w: 20,
    h: 16,
    blurb: "Travel alternative. The 14 minutes is an illustrative bus connection, not a walk.",
  },
];

export function parkById(id: string): CarPark {
  const found = PARKS.find((p) => p.id === id);
  if (!found) throw new Error(`Unknown car park ${id}`);
  return found;
}

function bayLabel(index: number, kind: BayKind, parkId: string): string {
  const n = (index + 1).toString().padStart(2, "0");
  if (kind === "accessible") return `Accessible · A${n}`;
  if (parkId === "horizon") {
    const level = (index % 4) + 1;
    return `Level ${level} · B${n}`;
  }
  return `Bay ${n}`;
}

export const BAYS: Bay[] = PARKS.flatMap((park) => {
  const general: Bay[] = Array.from({ length: park.bookableGeneral }, (_, i) => ({
    id: `${park.id}-g-${(i + 1).toString().padStart(2, "0")}`,
    parkId: park.id,
    kind: "general",
    label: bayLabel(i, "general", park.id),
  }));
  const accessible: Bay[] = Array.from({ length: park.bookableAccessible }, (_, i) => ({
    id: `${park.id}-a-${(i + 1).toString().padStart(2, "0")}`,
    parkId: park.id,
    kind: "accessible",
    label: bayLabel(i, "accessible", park.id),
  }));
  return [...general, ...accessible];
});

export function baysFor(parkId: string, kind: BayKind): Bay[] {
  return BAYS.filter((b) => b.parkId === parkId && b.kind === kind);
}

export function bayById(id: string): Bay | undefined {
  return BAYS.find((b) => b.id === id);
}

export const DESK = {
  phone: "0117 496 0148",
  note: "Fictional Ofcom drama number for Bristol. Not a hospital line.",
};
