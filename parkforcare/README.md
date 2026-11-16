# ParkForCare

Illustrative prototype of a hospital parking and patient-arrival planner, built for a University of Bristol CENGM0081 Smart Cities and Infrastructure pitch.

The assessed submission is the seven-minute pitch and the slide deck. This app is the optional demonstrator. It uses fictional patients, a fictional campus layout and a deterministic simulation. It is not an NHS service and it is not connected to any hospital system.

## Run it

```bash
cd parkforcare
npm install
npm run dev
```

Open the URL Vite prints (usually http://localhost:5173).

```bash
npm test
npm run build
```

No API keys, database or NHS login.

## Pitch click-path

The three scenario buttons reload a fixed day. **Reset this scenario** puts the holds back. **Patient** and **Hospital team** share the same ledger and the same assumptions.

1. **Normal appointment.** Jordan Hale, cardiology, Tuesday 17 November 2026, 10:30, coming from Bedminster. Show the recommended arrival, hold a Horizon bay, then the journey plan. Switch to the hospital view: the day peaks without a shortage.
2. **Parking shortage.** Alex Okonkwo, orthopaedics, Wednesday 18 November 2026, 09:15, from Bradley Stoke. Extra lists and half of Horizon closed. Hospital bookable bays are already held. Riverside or the bus is the alternative. The hospital board opens at 10:00, when the forecast is over capacity. Clinic lists are not moved.
3. **Clinic delay.** Samira Begum, respiratory, Thursday 19 November 2026, 10:00, from Clifton. The list is 45 minutes late. The arrival advice does not change until the clinic instruction is accepted, and even then it moves only 20 minutes, still before the time on the letter. A Horizon bay is already held and can be extended or started later.

Friday 20 November is on the hospital date control only, as a quieter list.

## File structure

```
parkforcare/
  index.html
  src/
    main.tsx                 React entry
    App.tsx                  Provider and shell
    components/
      Shell.tsx              Header, scenarios, footer
      PatientView.tsx        Appointment, parking, journey, alerts
      DashboardView.tsx      Occupancy, charts, advice, sliders
      CampusMap.tsx          Schematic campus, not a live map
    state/SimulationContext.tsx
    data/
      campus.ts              Fictional car parks, bays, departments
      schedules.ts           Four clinic days
      scenarios.ts           The three pitch scenarios
    engine/
      forecast.ts            Deterministic demand model
      journey.ts             Departure plan and buffers
      reservations.ts        Holds, double-book checks, seeds
      advice.ts              Desk responses and model notes
      model.test.ts
```

The patient screen and the hospital screen both read `SimulationContext`. A hold updates the bookable bays and the reservation log immediately.

## Architecture

```
clinic lists (fictional) ──┐
assumptions (sliders) ─────┼──► forecast (expected vehicles by half hour)
weekday staff / visitors ──┘            │
                                        ▼
patient plan ◄── arrival, journey, alternatives
hospital desk ◄── occupancy, warnings, responses

reservation ledger ──► named bay holds only
```

Four layers, kept separate on purpose:

1. **Clinic list.** Outpatient times and durations. The app never edits them.
2. **Forecast.** Expected vehicles. Staff and visitors are a fixed profile. Patient cars are the car-mode share times a demand multiplier. This is a simulation, not a sensor reading and not a validated forecast.
3. **Bookable bays.** A small named inventory inside each car park. A hold is confirmed. It cannot overlap another hold on the same bay, and it cannot exceed that inventory. Accessible bays are a separate inventory.
4. **Journey plan.** Preset durations, not live traffic. The recommended departure is set so the simulated arrival matches the recommended arrival. The buffer is stated once.

In a real deployment the “now” occupancy would come from bay sensors or barrier counts. Here, “now” is the model evaluated at the scenario clock (patient) or the time slider (hospital).

Bays are stored as small asset records: car park, kind, label. That is the operational information a facilities team would actually need. It is not a building information model.

Holds are written to a session log. One hospital can keep that as an ordinary database. A shared ledger across several car-park operators is a later design question. This prototype does not use a blockchain, and it does not need one.

## Forecast assumptions

Evaluated every 30 minutes from 06:00 to 20:00.

- Staff profile peaks just under 200 vehicles late morning, with a lunch dip and an evening departure. The shortage scenario scales staff by 1.05.
- Visitors peak under 40. The shortage scenario scales them by 1.25.
- A listed outpatient contributes `carModeShare × demandMultiplier` of a car. On a normal day that is 0.40. On the shortage day the listed clinics are already denser, the share is 0.72, and the multiplier is 2.30 so the slider can stand in for extra lists that are not printed on the sample.
- The car is present from 25 minutes before the appointment until the booked duration, plus any reported clinic delay, plus a 20 minute overrun allowance.
- Accessible spaces are excluded from this fill. Chapel Court is accessible-only.
- Fifteen percent of vehicles try Garden Surface first. The rest try Horizon, then remaining hospital space, then Riverside. Anything left is unmet demand.
- North Park & Ride is not in the fill. It is a bus alternative with an illustrative 14 minute connection.
- Horizon can be partly closed with the “open” slider. The shortage day starts at 50 percent.

Changing a slider does not move an appointment.

## Reservations

- A hold has a start (when the plan says the driver reaches the car park) and an end (slot + reported delay + overrun allowance).
- The same bay cannot be held twice for overlapping times.
- General booking cannot take an accessible bay. Accessible booking cannot take a general bay.
- Park & Ride cannot be reserved.
- Cancelling releases the bay. Extending adds 30 minutes if that bay is free. Moving the start later is offered only after the clinic instruction is accepted.
- Shortage morning: every general bookable bay in Horizon and Garden is pre-held from 07:30 to 13:30. Riverside is not.

Illustrative tariffs are labels. No payment is taken. Eligible free parking is not checked.

## Journey assumptions

Preset places use one fixed weekday-morning duration each. A typed place uses a generic duration and is not geocoded.

| Place | Car | Bus | Train | Cycle | Walk |
| --- | ---: | ---: | ---: | ---: | ---: |
| Bedminster | 18 | 32 | — | 22 | 70 |
| Clifton | 12 | 24 | — | 10 | 28 |
| Bradley Stoke | 28 | 55 | 40 | 55 | — |
| Gloucester Road | 14 | 26 | — | 16 | 45 |
| Yate | 35 | 62 | 38 | — | — |
| Typed place | 25 | 45 | — | 35 | — |

Finding a bay is 3 minutes when general parking looks comfortable and 8 when it is limited, scarce, or unmet demand is predicted. Walking adds the car-park time and a few minutes inside the wing.

The arrival buffer is 25 minutes before the appointment, plus 10 minutes if driving looks tight. There is no second hidden buffer. Departure is set so a journey that matches these figures arrives at the recommended time.

A clinic delay does not change that advice by itself. Scenario 3 has a hypothetical instruction allowing arrival 20 minutes later than the original recommendation, still at least 5 minutes before the time on the letter. The full 45 minute delay is used only to keep the bay hold long enough. The app will not tell a patient to wait out a delay unless that instruction is present and the patient accepts it.

Someone who does not want a smartphone can quote the same appointment reference to the fictional desk on 0117 496 0148 (an Ofcom drama number, not a hospital line) or at reception. The bookable inventory is the same.

## Limitations

- Not a live map, live traffic feed, payment flow, or sensor network.
- Not trained on hospital data. The multiplier and the staff profile are assumptions you can edit.
- One patient is signed in per scenario. Other patients exist only as list times or as pre-held bays.
- The campus geography is invented. It is not a plan of Bristol Royal Infirmary.
- The model can show more than one “car” per listed appointment when the demand multiplier is above one. That is a stand-in for unlisted clinics, and the screen says so.
- Rounding is to the nearest vehicle on the charts. The tests check behaviour (capacity, unmet demand, double-booking), not a clinical validation.
- No accounts, persistence, or concurrent users. Refreshing the page resets the session.

## Context the pitch can use, without over-claiming

NHS England’s Hospital Outpatient Activity publication for 2023–24 reports 135.4 million outpatient appointments, of which 5.9% were recorded as did not attend. That shows missed outpatients are a real operational problem. It does not show that parking caused them, and this prototype does not claim to reduce that rate.

https://digital.nhs.uk/data-and-information/publications/statistical/hospital-outpatient-activity/2023-24/summary-reports

The idea sits next to the unit rather than copying a lecture technology:

- Journey mode choice treats the hospital as a mobility destination, which is the MaaS point, instead of building another closed car-park app.
- The hospital screen is decision support on top of a simple forecast. A deployment would replace the simulated “now” with bay sensors. That is an operations analogue of monitor-then-decide, not structural health monitoring of the building.
- Bays are asset records for operations. That is as far as the building-information idea needs to go here.
- A blockchain is not used. One operator can store holds in an ordinary log.

The group still needs its own slide deck: personas beyond the three in the app, a business model, feasibility, and the risks. A plausible operating story is that the hospital or the car-park operator pays for the software, patient use is free, and accessible bays are never the thing being sold. Do not imply an NHS partnership.

## AI use, for the presenter notes

This prototype was drafted with Cursor’s Grok 4.7 from the group’s ParkForCare brief and the coursework brief. The University’s assessment policy allows generative AI for a mock prototype under Category 3 (selective use). The group should say which model was used, what it did, and that the group is responsible for the correctness of what it presents. Do not leave that note off the deck.

## Stack

React 18, TypeScript, Vite, Tailwind CSS, Recharts. Tests are Vitest. Data lives in `src/data` and `src/engine`.
