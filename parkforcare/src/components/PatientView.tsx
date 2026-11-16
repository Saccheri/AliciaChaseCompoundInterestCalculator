import { bayById, departmentById, HOSPITAL, parkById } from "../data/campus";
import { firstFreeBay } from "../engine/reservations";
import { ORIGINS, MODE_LABEL, type Mode } from "../engine/journey";
import { bandFor, type ParkForecast } from "../engine/forecast";
import { formatDate, formatTime } from "../engine/time";
import { useSim } from "../state/SimulationContext";
import { CampusMap } from "./CampusMap";
import { BandPill, Card, Eyebrow, Message } from "./ui";

const TABS = [
  ["appointment", "Appointment"],
  ["parking", "Parking"],
  ["journey", "Journey"],
  ["alerts", "Alerts"],
] as const;

function statusFor(delayMin: number, nowMin: number, startMin: number, durationMin: number): string {
  if (delayMin > 0) return "Running late";
  if (nowMin >= startMin + durationMin) return "Finished";
  if (nowMin >= startMin) return "In clinic";
  return "Scheduled";
}

function tariff(parkId: string, startMin: number, endMin: number): string {
  const park = parkById(parkId);
  if (park.hourly == null) return `${park.priceLabel}. No payment is taken.`;
  if (park.hourly === 0) return "Illustrative £0. Eligible free parking is not checked, and no payment is taken.";
  const amount = park.hourly * ((endMin - startMin) / 60);
  return `Illustrative £${amount.toFixed(2)} for this hold, at £${park.hourly.toFixed(2)} an hour. No payment is taken.`;
}

export function PatientView() {
  const sim = useSim();
  const department = departmentById(sim.focus.departmentId);
  const status = statusFor(
    sim.focus.delayMin,
    sim.scenario.nowMin,
    sim.focus.startMin,
    sim.focus.durationMin,
  );

  return (
    <div className="mx-auto grid max-w-6xl gap-6 px-4 py-6 lg:grid-cols-[minmax(0,32rem)_minmax(0,1fr)]">
      <div>
        <nav className="mb-4 grid grid-cols-4 gap-1 rounded-2xl bg-[#d5e3db] p-1" aria-label="Patient sections">
          {TABS.map(([id, label]) => (
            <button
              key={id}
              type="button"
              data-testid={`tab-${id}`}
              aria-current={sim.tab === id ? "page" : undefined}
              className={`rounded-xl px-1 py-2 text-sm font-semibold ${
                sim.tab === id ? "bg-paper text-ink shadow-sm" : "text-[#245246]"
              }`}
              onClick={() => sim.setTab(id)}
            >
              {label}
            </button>
          ))}
        </nav>

        {sim.message && (
          <div className="mb-4" role="alert">
            <Message tone="critical">{sim.message}</Message>
          </div>
        )}

        {sim.tab === "appointment" && (
          <AppointmentPanel status={status} wing={department.wing} extraWalk={department.extraWalkMin} />
        )}
        {sim.tab === "parking" && <ParkingPanel />}
        {sim.tab === "journey" && <JourneyPanel />}
        {sim.tab === "alerts" && <AlertsPanel />}
      </div>

      <aside className="lg:pt-14">
        <Card>
          <Eyebrow>Demo path</Eyebrow>
          <h2 className="mt-1 font-serif text-2xl">{sim.scenario.name}</h2>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-relaxed">
            {sim.scenario.steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
          <p className="mt-4 text-xs leading-relaxed text-[#3e534c]">
            Scenario clock {formatTime(sim.scenario.nowMin)}. Switching scenario reloads its fictional day and clears holds made in this session.
          </p>
        </Card>
        <Card className="mt-4">
          <Eyebrow>Same data, two desks</Eyebrow>
          <p className="mt-2 text-sm leading-relaxed">
            A hold made here is a confirmed bay. The hospital chart is a simulation of everyone else. The two are not the same kind of number.
          </p>
        </Card>
      </aside>
    </div>
  );
}

function AppointmentPanel({
  status,
  wing,
  extraWalk,
}: {
  status: string;
  wing: string;
  extraWalk: number;
}) {
  const sim = useSim();
  const arrival = sim.plan.ok ? formatTime(sim.plan.recommendedArrivalMin) : "—";
  return (
    <div className="space-y-4">
      <Card>
        <Eyebrow>{sim.focus.patientName}</Eyebrow>
        <h2 className="mt-1 font-serif text-3xl leading-tight">Outpatient appointment</h2>
        <p className="mt-2 text-sm text-[#3e534c]">Reference {sim.focus.reference}</p>
        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-[#3e534c]">Hospital</dt>
            <dd className="font-semibold">{HOSPITAL.name}</dd>
          </div>
          <div>
            <dt className="text-[#3e534c]">Department</dt>
            <dd className="font-semibold">{sim.departmentName}</dd>
          </div>
          <div>
            <dt className="text-[#3e534c]">Where to walk</dt>
            <dd className="font-semibold">{wing}</dd>
          </div>
          <div>
            <dt className="text-[#3e534c]">Date</dt>
            <dd className="font-semibold">{formatDate(sim.focus.date)}</dd>
          </div>
          <div>
            <dt className="text-[#3e534c]">Time on the letter</dt>
            <dd className="font-serif text-2xl">{formatTime(sim.focus.startMin)}</dd>
          </div>
          <div>
            <dt className="text-[#3e534c]">Booked duration</dt>
            <dd className="font-semibold">{sim.focus.durationMin} min</dd>
          </div>
          <div>
            <dt className="text-[#3e534c]">Status</dt>
            <dd className="font-semibold">{status}</dd>
          </div>
          <div>
            <dt className="text-[#3e534c]">Wing walk</dt>
            <dd className="font-semibold">about {extraWalk} min from the entrance</dd>
          </div>
        </dl>
      </Card>
      <Card>
        <Eyebrow>Recommended arrival</Eyebrow>
        <p className="mt-1 font-serif text-4xl">{arrival}</p>
        <p className="mt-2 text-sm leading-relaxed">
          {sim.plan.ok
            ? sim.shiftAccepted && sim.focus.approvedShiftMin > 0
              ? `This is ${sim.focus.approvedShiftMin} minutes later than the original plan, and still before ${formatTime(sim.focus.startMin)}. It is only shown because a hypothetical clinic instruction allows it.`
              : `Be at ${sim.departmentName} ${sim.plan.leadMin} minutes before ${formatTime(sim.focus.startMin)}. That buffer is the whole allowance. Journey uncertainty is not added again on top.`
            : sim.plan.reason}
        </p>
      </Card>
      <Card>
        <Eyebrow>No smartphone needed</Eyebrow>
        <p className="mt-2 text-sm leading-relaxed">
          The same bookable bays can be held by the fictional parking desk on {sim.desk.phone}, or at outpatients reception. Quote {sim.focus.reference}. {sim.desk.note}
        </p>
      </Card>
      <p className="text-xs leading-relaxed text-[#3e534c]">{HOSPITAL.note}</p>
    </div>
  );
}

function ParkingPanel() {
  const sim = useSim();
  const arrivalLabel = sim.plan.ok ? formatTime(sim.plan.recommendedArrivalMin) : "arrival";
  const selected = sim.selectedParkId ? parkById(sim.selectedParkId) : null;
  const kind = sim.needsAccessible ? "accessible" : "general";
  const windowOk = sim.plan.ok;
  const freeBay =
    selected && windowOk && sim.plan.ok
      ? firstFreeBay(
          sim.reservations,
          selected.id,
          kind,
          sim.focus.date,
          Math.round(sim.plan.parkArrivalMin),
          Math.round(sim.plan.bookingEndMin),
        )
      : null;
  let block: string | null = null;
  if (!selected) block = "Choose a car park on the map or in the list.";
  else if (selected.kind === "park-ride") block = "Park & Ride is a bus alternative. There is no bay to hold.";
  else if (!windowOk) block = sim.plan.ok ? null : sim.plan.reason;
  else if (sim.mine) block = "This appointment already has a bay. Change that hold, or cancel it first.";
  else if (!freeBay) {
    block = sim.needsAccessible
      ? "No accessible bay is free here for that whole stay."
      : "No general bookable bay is free here for that whole stay.";
  }

  return (
    <div className="space-y-4">
      <Card>
        <Eyebrow>Campus, simplified</Eyebrow>
        <h2 className="mt-1 font-serif text-2xl">Where to leave the car</h2>
        <div className="mt-3">
          <CampusMap
            parks={sim.arrivalMoment.parks}
            selectedId={sim.selectedParkId}
            onSelect={sim.selectPark}
            caption={`Colour is predicted general availability at ${arrivalLabel}. A “held” count is a named bay already confirmed. Accessible spaces are blue and are not part of the general free count.`}
          />
        </div>
      </Card>

      <Card>
        <label className="flex items-start gap-3 text-sm leading-relaxed">
          <input
            type="checkbox"
            className="mt-1 h-5 w-5"
            checked={sim.needsAccessible}
            onChange={(event) => sim.setAccessible(event.target.checked)}
          />
          <span>
            <span className="font-semibold">I need an accessible bay.</span> General bookings cannot take these spaces. Eligible free parking is not checked.
          </span>
        </label>
      </Card>

      <div className="space-y-3">
        {sim.arrivalMoment.parks.map((park) => (
          <ParkCard key={park.park.id} forecast={park} arrivalLabel={arrivalLabel} />
        ))}
      </div>

      <Card>
        <Eyebrow>Hold a bay</Eyebrow>
        {windowOk && (
          <p className="mt-2 text-sm leading-relaxed">
            Proposed hold {formatTime(sim.plan.ok ? sim.plan.parkArrivalMin : 0)} – {formatTime(sim.plan.ok ? sim.plan.bookingEndMin : 0)}.
            The end includes the booked slot{sim.focus.delayMin ? `, ${sim.focus.delayMin} minutes of reported delay,` : ""} and a {sim.assumptions.overrunMin} minute overrun allowance.
          </p>
        )}
        <button
          type="button"
          data-testid="reserve-button"
          disabled={Boolean(block)}
          className="mt-3 w-full rounded-xl bg-spruce px-4 py-3 text-base font-semibold text-white disabled:cursor-not-allowed disabled:bg-[#9aada6]"
          onClick={sim.reserve}
        >
          {sim.needsAccessible ? "Hold an accessible bay" : "Hold a general bay"}
        </button>
        {block && <p className="mt-2 text-sm text-[#3e534c]">{block}</p>}
      </Card>

      {sim.mine && <HoldCard />}
    </div>
  );
}

function ParkCard({ forecast, arrivalLabel }: { forecast: ParkForecast; arrivalLabel: string }) {
  const sim = useSim();
  const now = sim.nowMoment.parks.find((p) => p.park.id === forecast.park.id);
  const selected = sim.selectedParkId === forecast.park.id;
  const band = bandFor(forecast);
  return (
    <Card className={selected ? "ring-2 ring-spruce" : ""}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-serif text-xl">{forecast.park.name}</h3>
          <p className="text-sm text-[#3e534c]">{forecast.park.blurb}</p>
        </div>
        <BandPill band={band} />
      </div>
      {forecast.park.kind === "park-ride" ? (
        <p className="mt-3 text-sm leading-relaxed">
          Not part of the campus parking fill. Illustrative bus connection {forecast.park.walkMin} minutes, then the walk to the clinic. {forecast.park.priceLabel}. No bay is held here.
        </p>
      ) : (
        <>
          <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl bg-mist px-2 py-2">
              <dt className="text-[11px] uppercase tracking-wide text-[#3e534c]">
                {forecast.generalCapacity === 0 ? "Accessible" : "Free now"}
              </dt>
              <dd className="font-serif text-2xl">
                {forecast.generalCapacity === 0 ? Math.round(forecast.accessible) : Math.round(now?.generalFree ?? 0)}
              </dd>
            </div>
            <div className="rounded-xl bg-mist px-2 py-2">
              <dt className="text-[11px] uppercase tracking-wide text-[#3e534c]">
                {forecast.generalCapacity === 0 ? "Still held" : `Free at ${arrivalLabel}`}
              </dt>
              <dd className="font-serif text-2xl">
                {forecast.generalCapacity === 0 ? Math.round(forecast.accessible) : Math.round(forecast.generalFree)}
              </dd>
            </div>
            <div className="rounded-xl bg-[#e7eef8] px-2 py-2">
              <dt className="text-[11px] uppercase tracking-wide text-reserved">Reserved</dt>
              <dd className="font-serif text-2xl text-reserved">{forecast.reserved}</dd>
            </div>
          </dl>
          <p className="mt-2 text-xs leading-relaxed text-[#3e534c]">
            {forecast.generalCapacity === 0
              ? "These spaces are protected. They are not offered as general parking, and the free-parking rule is not checked."
              : `Free is a prediction of general spaces. Reserved is a confirmed bay. ${Math.round(forecast.accessible)} accessible spaces are held back and are not in the free count.`}
            {" "}Capacity {Math.round(forecast.capacity)}. {forecast.park.kind === "hospital" || forecast.park.kind === "alternative" ? `Walk ${forecast.park.walkMin} min.` : ""} {forecast.park.priceLabel}. Bookable {sim.needsAccessible ? "accessible" : "general"} bays left at this time: {sim.needsAccessible ? forecast.bookableAccessibleLeft : forecast.bookableGeneralLeft}.
          </p>
        </>
      )}
      {forecast.park.kind !== "park-ride" && (
        <button
          type="button"
          className="mt-3 rounded-xl border border-spruce px-3 py-2 text-sm font-semibold text-spruce"
          aria-pressed={selected}
          onClick={() => sim.selectPark(forecast.park.id)}
        >
          {selected ? "Selected" : "Select this car park"}
        </button>
      )}
    </Card>
  );
}

function HoldCard() {
  const sim = useSim();
  if (!sim.mine) return null;
  const bay = bayById(sim.mine.bayId);
  const park = parkById(sim.mine.parkId);
  const canShift = sim.shiftAccepted && sim.focus.approvedShiftMin > 0 && sim.plan.ok;
  return (
    <Card testId="reservation-card">
      <Eyebrow>Confirmed reservation</Eyebrow>
      <h3 className="mt-1 font-serif text-2xl">{bay?.label ?? sim.mine.bayId}</h3>
      <p className="text-sm">{park.name}</p>
      <p className="mt-2 font-semibold">
        {formatTime(sim.mine.startMin)} – {formatTime(sim.mine.endMin)}
      </p>
      <p className="mt-2 text-sm leading-relaxed">
        This bay is held in the simulation. It is not a prediction. The coloured availability numbers are predictions and can change when the assumptions change. Cancelling releases the bay.
      </p>
      <p className="mt-2 text-sm">{tariff(park.id, sim.mine.startMin, sim.mine.endMin)}</p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <button type="button" className="rounded-xl bg-deep px-3 py-2 text-sm font-semibold text-white" onClick={sim.extendHold}>
          Extend by 30 min
        </button>
        <button
          type="button"
          className="rounded-xl border border-deep px-3 py-2 text-sm font-semibold disabled:opacity-40"
          disabled={!canShift}
          onClick={sim.shiftHold}
        >
          Move start to the later arrival
        </button>
        <button type="button" className="rounded-xl border border-clay px-3 py-2 text-sm font-semibold text-clay" onClick={sim.cancelHold}>
          Cancel hold
        </button>
      </div>
      {!canShift && sim.focus.approvedShiftMin > 0 && (
        <p className="mt-2 text-xs leading-relaxed text-[#3e534c]">
          The later start stays locked until you accept the clinic instruction on the Alerts tab.
        </p>
      )}
    </Card>
  );
}

function JourneyPanel() {
  const sim = useSim();
  const modes: Mode[] = ["car", "bus", "train", "cycle", "walk"];
  return (
    <div className="space-y-4">
      <Card>
        <Eyebrow>Starting point</Eyebrow>
        <label className="mt-3 block text-sm font-semibold" htmlFor="origin">
          Preset place
        </label>
        <select
          id="origin"
          className="mt-1 w-full rounded-xl border border-line bg-white px-3 py-2"
          value={sim.originId}
          onChange={(event) => sim.setOrigin(event.target.value)}
        >
          {ORIGINS.map((origin) => (
            <option key={origin.id} value={origin.id}>
              {origin.label} · {origin.detail}
            </option>
          ))}
        </select>
        <label className="mt-3 block text-sm font-semibold" htmlFor="custom-origin">
          Or type a place
        </label>
        <input
          id="custom-origin"
          className="mt-1 w-full rounded-xl border border-line px-3 py-2"
          value={sim.customOrigin}
          placeholder="A place not on the list"
          onChange={(event) => sim.setCustomOrigin(event.target.value)}
        />
        <p className="mt-2 text-xs leading-relaxed text-[#3e534c]">
          A typed place uses one generic simulated duration. Nothing is geocoded, and no live traffic service is called.
        </p>
      </Card>

      <Card>
        <Eyebrow>Mode</Eyebrow>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
          {modes.map((mode) => (
            <button
              key={mode}
              type="button"
              aria-pressed={sim.mode === mode}
              className={`rounded-xl border px-2 py-2 text-sm font-semibold ${
                sim.mode === mode ? "border-spruce bg-spruce text-white" : "border-line bg-white"
              }`}
              onClick={() => sim.setMode(mode)}
            >
              {MODE_LABEL[mode]}
            </button>
          ))}
        </div>
      </Card>

      {!sim.plan.ok && (
        <Message tone="warn">{sim.plan.reason}</Message>
      )}

      {sim.plan.ok && <JourneyResult />}

      {sim.mine && sim.mode !== "car" && (
        <Message tone="info">
          You still have a bay held. Cancel it on the Parking tab if you are not arriving by car.
        </Message>
      )}
    </div>
  );
}

function JourneyResult() {
  const sim = useSim();
  if (!sim.plan.ok) return null;
  const plan = sim.plan;
  const steps = [
    ["Leave", `${sim.origin.label} at ${formatTime(plan.departureMin)}`],
    [MODE_LABEL[sim.mode], `${plan.travelMin} min simulated`],
    ...(sim.mode === "car" ? [["Find a bay", `${plan.searchMin} min`]] : []),
    ["Walk to the clinic", `${plan.walkMin} min`],
    ["Estimated arrival", formatTime(plan.estimatedArrivalMin)],
    ["Appointment", formatTime(sim.focus.startMin)],
  ];
  return (
    <Card>
      <Eyebrow>Plan</Eyebrow>
      <p className="mt-1 font-serif text-4xl">{formatTime(plan.departureMin)}</p>
      <p className="text-sm text-[#3e534c]">Recommended departure</p>
      <ol className="mt-4 space-y-3 border-l-2 border-spruce pl-4">
        {steps.map(([title, detail]) => (
          <li key={title}>
            <p className="text-xs font-semibold uppercase tracking-wide text-spruce">{title}</p>
            <p className="text-base">{detail}</p>
          </li>
        ))}
      </ol>
      <p className="mt-4 text-sm leading-relaxed">
        Estimated journey {plan.travelMin} min. {sim.mode === "car" ? `Finding and reaching a bay ${plan.searchMin} min, then ` : ""}
        walking {plan.walkMin} min. Estimated arrival at the department {formatTime(plan.estimatedArrivalMin)}, which is the recommended arrival. The buffer is {plan.leadMin} minutes before the appointment
        {plan.extraLeadMin ? `, including ${plan.extraLeadMin} extra minutes because general parking looks tight` : ""}.
      </p>
      {sim.mode === "car" && (sim.arrivalMoment.unmet > 1 || sim.arrivalMoment.hospitalUtil >= 0.9) && (
        <div className="mt-3">
          <Message tone="warn">
            Driving looks tight in the simulation. A bus does not need a hospital bay. Switch mode to compare the leave time. Clinic appointments are not moved.
          </Message>
        </div>
      )}
      <details className="mt-4">
        <summary className="cursor-pointer text-sm font-semibold">Assumptions behind this plan</summary>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-relaxed">
          {plan.assumptions.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </details>
    </Card>
  );
}

function AlertsPanel() {
  const sim = useSim();
  const delayed = sim.focus.delayMin > 0;
  return (
    <div className="space-y-4">
      {delayed ? (
        <div data-testid="alert-delay">
          <Message tone="critical">
            {sim.departmentName} reports this list is about {sim.focus.delayMin} minutes behind. Your appointment time is still {formatTime(sim.focus.startMin)}. ParkForCare has not moved it.
          </Message>
        </div>
      ) : (
        <Message tone="ok">No delay is reported for this clinic list. Keep the original arrival.</Message>
      )}

      <Card>
        <Eyebrow>What you should do</Eyebrow>
        {sim.focus.approvedShiftMin > 0 ? (
          <>
            <p className="mt-2 text-sm leading-relaxed">
              A hypothetical hospital instruction for this list allows arriving up to {sim.focus.approvedShiftMin} minutes later than the original recommendation. That later time is still before the time on the letter. The instruction does not authorise waiting out the full {sim.focus.delayMin} minute delay.
            </p>
            <button
              type="button"
              className="mt-3 rounded-xl bg-deep px-3 py-2 text-sm font-semibold text-white"
              aria-pressed={sim.shiftAccepted}
              onClick={() => sim.setShift(!sim.shiftAccepted)}
            >
              {sim.shiftAccepted ? "Later arrival accepted — tap to undo" : "Accept the later arrival"}
            </button>
            {sim.shiftAccepted && sim.plan.ok && (
              <p className="mt-2 text-sm">
                Recommended arrival is now {formatTime(sim.plan.recommendedArrivalMin)}. The original plan is restored if you undo this.
              </p>
            )}
          </>
        ) : delayed ? (
          <p className="mt-2 text-sm leading-relaxed">
            There is no hospital instruction allowing a later arrival. Keep the original recommended arrival. You can extend a parking hold so a long clinic does not leave you without the bay.
          </p>
        ) : (
          <p className="mt-2 text-sm leading-relaxed">
            Nothing on this list asks you to change your arrival. If a hold exists, you can still extend it to cover an overrun.
          </p>
        )}
      </Card>

      {sim.mine ? (
        <HoldCard />
      ) : (
        <Card>
          <p className="text-sm leading-relaxed">No bay is held for this appointment yet. A delay does not create one automatically.</p>
        </Card>
      )}

      <Card>
        <Eyebrow>What did not change</Eyebrow>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-relaxed">
          <li>The appointment stays at {formatTime(sim.focus.startMin)}.</li>
          <li>Other patients’ appointments are not moved.</li>
          <li>A prediction of a busy car park is not a reserved bay.</li>
          <li>Accessible bays stay out of the general booking flow.</li>
        </ul>
      </Card>
    </div>
  );
}
