# Tribute New: the galaxy

Every war in `armada-war-tribute-new.html` is fought over a homeworld. There are 23, one per fleet, in one spiral galaxy.

## What you can do

- **See all of it.** `Tab`, or Galaxy in the bottom strip, lifts the camera above the spiral. Every homeworld is labelled with who holds it and how far away it is. Click a label to jump there.
- **Jump.** The bottom strip has a button per homeworld. `,` and `.` step through them.
- **Drive.** Free flight (`W A S D Q E`, drag to look) is slow among ships and near the ground and faster the further you are from anything, so you can fly from a battle to the next star in about half a minute. `Shift` is faster again. At the helm of a ship, cruise (`C`) does the same.
- **Go down to the cities.** Each world has a capital under its pole and five to eight other named cities. The world panel lists them; `L` goes to the capital. The horizon stays level wherever you are on the globe.
- **Attack.** "Send a fleet" at any world lets you pick any fleet. It jumps in over the capital and the holder defends. If you arrive at the helm of a ship, `Enter` calls your fleet in. If the attackers win, they hold the world: its lights take their colour and the strip shows it. "Restore the old borders" undoes every conquest. Ownership is kept in `localStorage`.
- Random and curated wars are placed too: at the defender's homeworld.

## How it is built

- `armada-universe-new.js` is the data: where the systems are, each world's biome, sun, cities and skyline, who holds what, and how fast free flight goes. No drawing. It runs in Node and has tests (`tests/tribute-new/universe.test.cjs`).
- `armada-cosmos-new.js` draws it and owns the controls.
- The war engine is unchanged in its own coordinates: the battle is at the origin. The galaxy knows where that origin is, in float64, and draws everything relative to the camera. A world 60 light-years from the fight is as sharp as the one under it, and nothing has to be moved when the camera leaves. The projection has no far plane.
- The engine gets the homeworld, its sun and the other bodies as collision spheres (ships and the camera cannot enter them, cruise slows near them) and as the light and eclipse sources for hulls. It draws none of them.
- A planet is a cap of rings centred under the camera, dense below and coarse at the horizon, always exactly on the sphere. Terrain, weather, the city plan and lights are procedural in the fragment shader. The air is single scattering through a thin shell, used for the limb from space, the sky from the ground and the haze on distant ground and towers.
- Cities are founded on dry land using a CPU port of the shader's continent noise. A skyline is instanced tapered boxes on a 500 m street grid, tallest first so a distant camera draws only the giants. The seat of power in each capital is several kilometres tall and visible from the battle.
- Worlds are scaled to feel large next to ships, not to be real: radii of 600 to 1,400 km, battles about 0.14 radii up, stars 7 or more "light-years" apart with a light-year set to a million kilometres.

## Limits

- The camera passes through buildings. Only the ground is solid.
- A war keeps running where it is if you fly away. Starting a new invasion replaces it.
- Fleets appear when a war starts. A world at peace has no ships in orbit.
- Checked in headless Chromium with software WebGL. Frame rate on real GPUs at 600 ships a side with a planet under the fight has not been measured.
