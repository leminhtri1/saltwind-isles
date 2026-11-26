# Saltwind Isles

[![make.fun · best-flight-game-20261126-0057](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/leminhtri1/saltwind-isles/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/leminhtri1/saltwind-isles/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)

An original island-hopping flight game for the desktop browser: fly the Kittiwake, a small high-wing bush plane, over a chain of windswept islands at golden hour. Thread rings, drop supplies to villages and land on short strips with an eye on fuel and damage. Rendered with hand-written WebGL2 (no libraries), with synthesised sound, and it plays offline from static files with keyboard and mouse.

## Missions

1. **Evening Approach**: thread the approach gate and land on runway 26 at Port Saltwind. You are scored on sink rate, touchdown zone, centreline, flare and stopping.
2. **Gull Rock Gauntlet**: a 14-ring timed course around Lantern Point and Gull Rock.
3. **Lifeline Drop**: four parachute crates for three villages. The card shows where a crate released now would land.
4. **Gull Rock Short Field**: a 440 m grass strip on a windy rock.
5. **Island Mail Run**: three stops on under a third of a tank. Stopping on any strip refuels and patches up the plane.
6. **Saltwind Crosswind**: a gusting 32 km/h crosswind landing.
7. **Free Flight**.

Hard landings, overspeed, high g and rough fields all add damage, and a badly damaged engine loses power or seizes. A crash gets a debrief that says what happened, for example "Stalled at 24 m, steep nose-down impact at 121 km/h".

## How to play

| Keys | Action |
| --- | --- |
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

To take off, set full throttle (0), let the speed build past about 100 km/h, then ease back on S. To land, add flaps, hold about 110 to 120 km/h with the throttle, aim for the touchdown zone, and flare just above the runway.

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
