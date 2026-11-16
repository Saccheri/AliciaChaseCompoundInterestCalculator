import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { DATE_OPTIONS } from "../data/schedules";
import { peakSlot } from "../engine/forecast";
import { formatShortDate, formatTime } from "../engine/time";
import { useSim } from "../state/SimulationContext";
import { CampusMap } from "./CampusMap";
import { Card, Eyebrow, Message } from "./ui";

export function DashboardView() {
  const sim = useSim();
  const peak = peakSlot(sim.series);
  const generalFree = Math.max(0, sim.inspect.generalCapacity - sim.inspect.occupancy);
  const occupancyPct =
    sim.inspect.generalCapacity === 0 ? 0 : Math.round((sim.inspect.occupancy / sim.inspect.generalCapacity) * 100);
  const accessible = Math.round(sim.inspect.capacity - sim.inspect.generalCapacity);
  const inspectLabel = formatTime(Math.floor(sim.inspectMin / 30) * 30);
  const chartData = sim.series.map((slot) => ({
    label: slot.label,
    staff: Math.round(slot.staff),
    visitors: Math.round(slot.visitors),
    patients: Math.round(slot.patientCars),
    capacity: Math.round(slot.generalCapacity),
    arrivals: Math.round(slot.arrivals),
    departures: Math.round(slot.departures),
  }));

  return (
    <div className="mx-auto max-w-6xl space-y-4 px-4 py-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Eyebrow>Hospital parking desk</Eyebrow>
          <h2 className="font-serif text-3xl">Today’s simulated campus</h2>
          <p className="max-w-2xl text-sm leading-relaxed text-[#3e534c]">
            Occupied and free are the model at the selected time. Reserved is a confirmed bay. This is not a sensor feed.
          </p>
        </div>
        <p className="text-sm">
          Patient scenario clock {formatTime(sim.scenario.nowMin)} · {formatShortDate(sim.scenario.date)}
        </p>
      </div>

      {sim.dashboardDate !== sim.scenario.date && (
        <Message tone="info">
          You are inspecting {formatShortDate(sim.dashboardDate)} with the {sim.scenario.name.toLowerCase()} assumptions. The patient screen stays on {formatShortDate(sim.scenario.date)}.
        </Message>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Kpi label="Total spaces" value={String(Math.round(sim.inspect.capacity))} note="Campus, not park & ride" />
        <Kpi label="Predicted occupied" value={String(Math.round(sim.inspect.occupancy))} note="General spaces in use" />
        <Kpi label="Predicted free" value={String(Math.round(generalFree))} note="General spaces only" />
        <Kpi label="Reserved" value={String(sim.inspect.reserved)} note="Confirmed bays at this time" />
        <Kpi label="Occupancy" value={`${occupancyPct}%`} note={`${accessible} accessible held back`} />
      </div>

      <Card>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <Eyebrow>Predicted demand</Eyebrow>
            <h3 className="font-serif text-2xl">Arrivals, departures and the space they need</h3>
          </div>
          <p className="text-sm">
            Peak general load {peak.label}, about {Math.round(peak.occupancy)} vehicles
            {peak.unmet > 1 ? `, with about ${Math.round(peak.unmet)} unmet` : ""}.
          </p>
        </div>
        <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Clinic day">
          {DATE_OPTIONS.map((day) => (
            <button
              key={day.date}
              type="button"
              aria-pressed={sim.dashboardDate === day.date}
              className={`rounded-xl border px-3 py-2 text-left text-sm ${
                sim.dashboardDate === day.date ? "border-deep bg-deep text-white" : "border-line bg-white"
              }`}
              onClick={() => sim.setDate(day.date)}
            >
              <span className="block font-semibold">{day.label}</span>
              <span className="block text-xs opacity-80">{day.tone}</span>
            </button>
          ))}
        </div>
        <label className="mt-4 block text-sm font-semibold" htmlFor="inspect-time">
          Inspect the campus at {formatTime(sim.inspectMin)}
        </label>
        <input
          id="inspect-time"
          type="range"
          min={6 * 60}
          max={19 * 60 + 30}
          step={15}
          value={sim.inspectMin}
          onChange={(event) => sim.setInspect(Number(event.target.value))}
          className="mt-2 w-full"
        />
        <div className="mt-4 h-80 w-full min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData}>
              <CartesianGrid stroke="#d5e0d8" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#1c2b27" }} interval={3} />
              <YAxis tick={{ fontSize: 11, fill: "#1c2b27" }} width={40} />
              <Tooltip />
              <Legend />
              <Area type="monotone" dataKey="staff" name="Staff" stackId="cars" fill="#1e5c4a" stroke="#1e5c4a" />
              <Area type="monotone" dataKey="visitors" name="Visitors" stackId="cars" fill="#c4a15a" stroke="#8a6a2f" />
              <Area type="monotone" dataKey="patients" name="Patient cars" stackId="cars" fill="#8fb4d6" stroke="#1d4e89" />
              <Line type="stepAfter" dataKey="capacity" name="General capacity" stroke="#8d2f2f" strokeDasharray="5 4" dot={false} strokeWidth={2} />
              <ReferenceLine x={inspectLabel} stroke="#10241e" strokeWidth={1.5} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-2 h-44 w-full min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid stroke="#d5e0d8" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#1c2b27" }} interval={3} />
              <YAxis tick={{ fontSize: 11, fill: "#1c2b27" }} width={40} />
              <Tooltip />
              <Legend />
              <Bar dataKey="arrivals" name="Arrivals in the half hour" fill="#1e5c4a" />
              <Bar dataKey="departures" name="Departures in the half hour" fill="#c4a15a" />
              <ReferenceLine x={inspectLabel} stroke="#10241e" />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-[#3e534c]">
          The stack is expected vehicles. The red line is general capacity, with accessible bays left out, so a crossing means those vehicles have nowhere that is open to general parking. The dark vertical line is the inspected time. Arrivals in the next half hour peak with the morning clinics; departures follow when slots, delays and the overrun allowance end.
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <FlowNote title="Arrivals around the inspected half hour" value={flowNear(chartData, inspectLabel, "arrivals")} />
          <FlowNote title="Departures around the inspected half hour" value={flowNear(chartData, inspectLabel, "departures")} />
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <Eyebrow>Car parks at {formatTime(sim.inspectMin)}</Eyebrow>
          <div className="mt-3">
            <CampusMap
              parks={sim.inspect.parks}
              selectedId={null}
              caption="Same campus as the patient map, coloured for the inspected time rather than one patient’s arrival."
            />
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[32rem] text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-[#3e534c]">
                <tr>
                  <th className="py-2 pr-2">Car park</th>
                  <th className="py-2 pr-2">Capacity</th>
                  <th className="py-2 pr-2">Occupied</th>
                  <th className="py-2 pr-2">Free</th>
                  <th className="py-2">Reserved</th>
                </tr>
              </thead>
              <tbody>
                {sim.inspect.parks.map((park) => (
                  <tr key={park.park.id} className="border-t border-line">
                    <td className="py-2 pr-2 font-semibold">{park.park.name}</td>
                    <td className="py-2 pr-2">{Math.round(park.capacity)}</td>
                    <td className="py-2 pr-2">{park.park.kind === "park-ride" ? "—" : Math.round(park.predictedOccupied)}</td>
                    <td className="py-2 pr-2">
                      {park.park.kind === "park-ride" ? "—" : park.generalCapacity === 0 ? "Protected" : Math.round(park.generalFree)}
                    </td>
                    <td className="py-2">{park.reserved}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <div className="space-y-4">
          <Card>
            <Eyebrow>What the desk can do</Eyebrow>
            <div className="mt-3 space-y-2">
              {sim.advice.map((item) => (
                <Message key={item.title} tone={item.level === "ok" ? "ok" : item.level === "critical" ? "critical" : item.level === "warn" ? "warn" : "info"}>
                  <span className="font-semibold">{item.title}. </span>
                  {item.body}
                </Message>
              ))}
            </div>
          </Card>
          <Card>
            <Eyebrow>Try a different day</Eyebrow>
            <p className="mt-2 text-sm leading-relaxed">
              These sliders change the simulation only. They do not edit the clinic list and they do not move {sim.focus.patientName}’s appointment.
            </p>
            <Slider
              label="Patients arriving by car"
              display={`${Math.round(sim.assumptions.carModeShare * 100)}%`}
              min={0.2}
              max={0.8}
              step={0.02}
              value={sim.assumptions.carModeShare}
              onChange={(value) => sim.patchAssumptions({ carModeShare: value })}
            />
            <Slider
              label="Appointment demand multiplier"
              display={`${sim.assumptions.demandMultiplier.toFixed(2)}×`}
              min={0.5}
              max={2.8}
              step={0.05}
              value={sim.assumptions.demandMultiplier}
              onChange={(value) => sim.patchAssumptions({ demandMultiplier: value })}
            />
            <Slider
              label="Horizon Multi-Storey open"
              display={`${Math.round(sim.assumptions.horizonOpenFactor * 100)}%`}
              min={0.4}
              max={1}
              step={0.05}
              value={sim.assumptions.horizonOpenFactor}
              onChange={(value) => sim.patchAssumptions({ horizonOpenFactor: value })}
            />
            <Slider
              label="Overrun allowance"
              display={`${sim.assumptions.overrunMin} min`}
              min={10}
              max={45}
              step={5}
              value={sim.assumptions.overrunMin}
              onChange={(value) => sim.patchAssumptions({ overrunMin: value })}
            />
            <button
              type="button"
              className="mt-3 rounded-xl border border-deep px-3 py-2 text-sm font-semibold"
              onClick={sim.resetAssumptions}
            >
              Reset assumptions for this scenario
            </button>
          </Card>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <Eyebrow>How the number is made</Eyebrow>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed">
            {sim.modelNotes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </Card>
        <Card>
          <Eyebrow>Reservation log</Eyebrow>
          <p className="mt-2 text-sm leading-relaxed">
            An append-only note of holds for this session. One hospital can run this as an ordinary log. A shared ledger across several operators is a later question, not a requirement for this prototype.
          </p>
          <ul className="mt-3 space-y-2">
            {sim.events.map((event) => (
              <li key={event.id} className="rounded-xl bg-mist px-3 py-2 text-sm">
                <span className="font-semibold">{event.title}. </span>
                {event.detail}
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}

function Kpi({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <Card>
      <p className="text-xs font-semibold uppercase tracking-wide text-[#3e534c]">{label}</p>
      <p className="font-serif text-4xl leading-tight">{value}</p>
      <p className="text-xs text-[#3e534c]">{note}</p>
    </Card>
  );
}

function Slider({
  label,
  display,
  min,
  max,
  step,
  value,
  onChange,
}: {
  label: string;
  display: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (value: number) => void;
}) {
  const id = label.replace(/\s+/g, "-").toLowerCase();
  return (
    <div className="mt-3">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-sm font-semibold">
          {label}
        </label>
        <span className="font-serif text-lg">{display}</span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-full"
      />
    </div>
  );
}

function FlowNote({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-xl bg-mist px-3 py-2">
      <p className="text-xs uppercase tracking-wide text-[#3e534c]">{title}</p>
      <p className="font-semibold">{value}</p>
    </div>
  );
}

function flowNear(
  rows: { label: string; arrivals: number; departures: number }[],
  label: string,
  key: "arrivals" | "departures",
): string {
  const row = rows.find((item) => item.label === label);
  if (!row) return "—";
  return `About ${row[key]} vehicles`;
}
