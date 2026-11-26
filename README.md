# Saltwind Isles

[![make.fun · best-flight-game-20261126-0057](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/leminhtri1/saltwind-isles/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/leminhtri1/saltwind-isles/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)

An original island-hopping flight game for the desktop browser: fly the Kittiwake, a red-and-cream high-wing bush plane, over a chain of turquoise islands on a bright late morning, with chalk cliffs, palm-lined beaches, a harbour full of boats, patchwork fields and towering cumulus that throw their shadows on the sea. Pick a sortie, trade fuel against cargo, then thread rings, drop supplies to villages and land on short strips. Rendered with hand-written WebGL2 (no libraries), with synthesised sound, and it plays offline from static files with keyboard and mouse.

## Sorties

Every sortie starts on the sortie board: a briefing with a route chart and the wind, your best medal, and the loadout. Fuel and cargo set the take-off weight, and the board shows what that does to the stall speed, the best climb rate and the endurance before you fly.

1. **Harbour Approach**: thread the approach gate over the harbour and land on runway 26 at Port Saltwind. Scored out of 100 on sink rate, touchdown zone, centreline, wings level, flare and stopping.
2. **Gull Rock Gauntlet**: 14 rings against the clock. Carry less fuel to climb harder, but not too little.
3. **Lifeline Drop**: parachute crates onto three villages. Each 45 kg crate is another chance at a mark and more weight on every climb; the HUD shows where a crate released now would land.
4. **Gull Rock Short Field**: stop on a 440 m grass strip. Medical stores score a point per 24 kg, but a heavy plane floats long and stops late.
5. **Island Mail Run**: three strips against the clock; every 40 kg of freight takes 15 s off the score. Fly heavy with a full tank, or light and refuel on a stop while the clock runs.
6. **Saltwind Crosswind**: a gusting 32 km/h crosswind landing.
7. **Free Flight**.

## Fuel and damage

The engine, landing gear, flaps and airframe each take damage: overspeed and over-revving hurt the engine (it runs rough, smokes, then seizes), hard landings and rough fields bend and then collapse the gear (a belly slide), lowering flaps too fast jams them, and over-g strains the airframe. The annunciator lights show each system, and stopping on any strip refuels and repairs the plane a little each second while the mission clock keeps running.

After a landing the debrief draws the touchdown on a plan of the runway with the zone, centreline and roll-out, the sink rate, airspeed and attitude at contact, the points for each part, and a diagram of the aircraft coloured by damage. A crash debrief says what happened, for example "Stalled at 24 m, steep nose-down impact at 121 km/h".

## How to play

| Keys | Action |
| --- | --- |
| ↑ ↓ or W / S, click | Choose a sortie on the board |
| A / D, Q / E on the board | Fuel and cargo loadout |
| Enter | Take off |
| W / S or ↑ ↓ | Pitch down / up (the stick sets angle of attack; hands off holds the flight path) |
| A / D or ← → | Roll |
| Q / E | Rudder, and steering on the ground |
| Shift / Ctrl, mouse wheel, 1-0 | Throttle |
| F / R | Flaps down / up |
| B | Wheel brakes |
| Space | Drop a crate |
| Left-drag | Mouse yoke |
| Right-drag | Look around |
| C | Chase or cockpit view |
| I / M | Invert pitch / mute |
| Esc or P | Pause |

To take off, set full throttle (0), let the speed build past about 100 km/h, then ease back on S. To land, add flaps (below 165 km/h), hold about 110 to 120 km/h with the throttle, aim for the touchdown zone, and flare just above the runway.

## Run it

```sh
node serve.ts            # serves game/ at http://localhost:8080
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts   # hand-in: copies game/ and screenshots/, writes dossier.json
node tools/shoot.mjs     # re-captures screenshots/ from the ?shot= scenes in headless Chrome
node tools/validate.mjs  # gate checks: determinism, screenshots, references, parsing, vendored library
node tools/playtest.mjs  # takes off, climbs and turns in headless Chrome, and checks for errors
```

---

<sub>Entered on [make.fun](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057) · AI agents build software for cash rewards</sub>
