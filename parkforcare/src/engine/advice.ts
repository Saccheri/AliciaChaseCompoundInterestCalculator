import type { MomentForecast, SlotForecast } from "./forecast";

export const MODEL_NOTES = [
  "Staff and visitor cars follow a fixed weekday profile. They do not come from the clinic list.",
  "Each listed outpatient adds the car-mode share, multiplied by the demand multiplier, of one car. The multiplier stands in for extra clinics. It does not move a listed appointment.",
  "A patient car is present from the arrival buffer, through the booked slot, any reported clinic delay, and the overrun allowance.",
  "Accessible bays are excluded from that fill and cannot be taken by a general booking.",
  "Fifteen percent of vehicles try Garden Surface first. The rest try Horizon, then any hospital space still open, then Riverside. Vehicles left over are unmet demand.",
  "A confirmed reservation holds one bookable bay. It is not added on top of the vehicle forecast, because that forecast already expects patients who drive.",
  "North Park & Ride is offered as a bus alternative. It is not part of the campus fill.",
  "These figures are a deterministic simulation for the pitch. They are not live sensors and not a validated forecast.",
];

export type Advice = {
  level: "ok" | "info" | "warn" | "critical";
  title: string;
  body: string;
};

export function managementAdvice(moment: MomentForecast, slots: SlotForecast[]): Advice[] {
  const advice: Advice[] = [];
  const laterSqueeze = slots.some((slot) => slot.hospitalUtil >= 0.9 || slot.unmet > 1);
  const riverside = moment.parks.find((p) => p.park.id === "riverside");
  const riversideFree = riverside ? Math.round(riverside.generalFree) : 0;

  if (moment.unmet > 1) {
    advice.push({
      level: "critical",
      title: "Predicted shortage at this time",
      body: `About ${Math.round(moment.unmet)} vehicles have no general space on the campus or at Riverside in this simulation. Tell arriving drivers about buses and North Park & Ride. Do not move clinic appointments from this screen.`,
    });
  } else if (moment.hospitalUtil >= 0.9) {
    advice.push({
      level: "warn",
      title: "Hospital car parks are near capacity",
      body:
        riversideFree > 10
          ? `Direct new drivers to Riverside Public Car Park, where about ${riversideFree} general spaces are still predicted free. Put the walk time on the sign and in the patient app before they commit.`
          : "Hospital car parks are near full and Riverside is tight as well. Publish the park-and-ride bus and local bus options at the entrance.",
    });
  } else if (laterSqueeze) {
    const slot = slots.find((item) => item.hospitalUtil >= 0.9 || item.unmet > 1);
    advice.push({
      level: "warn",
      title: "A tight period is predicted later",
      body: `The inspected time still has room, but the simulation crosses a capacity warning around ${slot?.label ?? "later"}. Prepare the alternative-car-park message before that peak.`,
    });
  } else {
    advice.push({
      level: "ok",
      title: "No capacity warning at this time",
      body: "Predicted general demand fits the open car parks. Bookable bays can still be held. This is a simulation, not a sensor reading.",
    });
  }

  advice.push({
    level: "info",
    title: "Keep accessible spaces protected",
    body: "Chapel Court and the accessible bays in other car parks are excluded from general allocation. A general booking cannot take them. Eligibility for free parking is not checked in this prototype.",
  });

  if (moment.hospitalUtil >= 0.85 || moment.unmet > 1) {
    advice.push({
      level: "info",
      title: "Allocation policy, not the clinic list",
      body: "A workable response is to shrink or close general bookable bays, keep accessible bays, and point confident walkers to Riverside or the bus. The outpatient list itself stays with the clinic.",
    });
  }

  advice.push({
    level: "info",
    title: "Appointments are not rescheduled here",
    body: "ParkForCare can change a parking hold. It cannot, and does not, move a hospital appointment.",
  });

  return advice;
}
