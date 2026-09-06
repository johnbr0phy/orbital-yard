# Three.js battle

Open `armada-war-three.html` through an HTTP server or GitHub Pages. The original `armada-war-tribute-new.html` and its dependencies are unchanged.

The new page uses locally vendored Three.js r160 (MIT license in `assets/three/LICENSE.txt`). No build service or CDN is required.

## Architecture

- `armada-three-main.js` owns the Three.js renderer, perspective camera, lighting and lifecycle.
- `armada-three-hulls.js` renders procedural ship geometry, mounted weapons, damage, wrecks and organic animation. Distant ships use instanced mesh geometry rather than point substitutes.
- `armada-three-worlds.js` renders planets, moons, rings, stars and distant dust at the simulation's world coordinates.
- `armada-three-effects.js` batches weapons, engines, arrival effects and explosions into bounded buffers.
- `armada-three-engine.js` preserves the existing fleets, simulation, controls and camera director. Its old GPU drawing loop is replaced by the Three.js renderer. Dormant legacy graphics calls operate on a CPU geometry store; they do not create a second WebGL context.
- `armada-three-geometry.js` preserves generated mesh data and partial damage edits for Three.js consumption.

`python3 scripts/build-three-port.py` regenerates the separate engine and HTML from the original battle page. Review regenerated differences before publishing. Shared systems, crew and AI scripts remain dependencies of both pages.

## Validation

Run `node --test tests/three/parity.test.cjs tests/three/geometry.test.mjs` for seeded original/port simulation parity, all 23 fleet builders and geometry storage tests.

Serve this directory with `python3 -m http.server 8771`, then run `node tests/three/browser-smoke.cjs` with Playwright installed. Optional `NODE_PATH`, `CHROMIUM_PATH` and `THREE_URL` select the installed runtime, browser and server. This checks actual Three.js rendering, keyboard steering, Space firing, camera changes and repeated scene replacement.

Additional browser checks exercised 1,142 ships without JavaScript or shader errors. This is a rendering migration, not a guarantee of 60 FPS: procedural construction, AI and collision work still use the existing CPU simulation. Hidden tabs pause simulation. Performance varies with hardware, battle size and camera position.
