import { useSim } from "../state/SimulationContext";
import { DashboardView } from "./DashboardView";
import { PatientView } from "./PatientView";

export function Shell() {
  const sim = useSim();
  return (
    <div className="min-h-screen">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-20 focus:rounded-lg focus:bg-paper focus:px-3 focus:py-2">
        Skip to content
      </a>
      <header className="bg-deep text-paper">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div>
            <p className="font-serif text-3xl leading-none">ParkForCare</p>
            <p className="mt-1 text-sm text-[#c9ddd4]">Fictional hospital arrival prototype · not an NHS service</p>
          </div>
          <div className="flex rounded-full bg-[#1c3b32] p-1" role="group" aria-label="Interface">
            <button
              type="button"
              data-testid="view-patient"
              aria-pressed={sim.view === "patient"}
              className={`rounded-full px-4 py-2 text-sm font-semibold ${sim.view === "patient" ? "bg-paper text-deep" : "text-paper"}`}
              onClick={() => sim.setView("patient")}
            >
              Patient
            </button>
            <button
              type="button"
              data-testid="view-hospital"
              aria-pressed={sim.view === "hospital"}
              className={`rounded-full px-4 py-2 text-sm font-semibold ${sim.view === "hospital" ? "bg-paper text-deep" : "text-paper"}`}
              onClick={() => sim.setView("hospital")}
            >
              Hospital team
            </button>
          </div>
        </div>
      </header>

      <div className="border-b border-line bg-[#f4f7f4]">
        <div className="mx-auto grid max-w-6xl gap-2 px-4 py-3 sm:grid-cols-3">
          {sim.scenarios.map((scenario) => (
            <button
              key={scenario.id}
              type="button"
              data-testid={`scenario-${scenario.id}`}
              aria-pressed={sim.scenario.id === scenario.id}
              className={`rounded-xl border px-3 py-2 text-left ${
                sim.scenario.id === scenario.id ? "border-deep bg-deep text-paper" : "border-line bg-paper"
              }`}
              onClick={() => sim.setScenario(scenario.id)}
            >
              <span className="block text-sm font-semibold">{scenario.name}</span>
              <span className={`block text-xs ${sim.scenario.id === scenario.id ? "text-[#d5e6dc]" : "text-[#3e534c]"}`}>
                {scenario.kicker}
              </span>
            </button>
          ))}
        </div>
        <div className="mx-auto flex max-w-6xl justify-end px-4 pb-3">
          <button type="button" className="text-sm font-semibold text-spruce underline" onClick={sim.resetScenario}>
            Reset this scenario
          </button>
        </div>
      </div>

      <main id="main">
        {sim.view === "patient" ? <PatientView /> : <DashboardView />}
      </main>

      <footer className="border-t border-line px-4 py-6 text-xs leading-relaxed text-[#3e534c]">
        <p className="mx-auto max-w-6xl">
          ParkForCare is a student prototype for a University of Bristol Smart Cities and Infrastructure pitch. Patients, appointments, tariffs, occupancy and journey times are fictional. It is not connected to NHS systems, it does not take payment, and it does not store medical records. Predictions are a deterministic simulation. A named bay hold is the only confirmed reservation.
        </p>
      </footer>
    </div>
  );
}
