# Orbital Yard

A procedural starship general-arrangement drawing, generated in the browser from a
seed. One self-contained HTML file, no build step, no dependencies.

**[Open it →](https://johnbr0phy.github.io/orbital-yard/)** · by [@JohnBr0](https://x.com/JohnBr0)

## What it does

Every ship is assembled from a slot contract rather than drawn: a hull topology
publishes five sockets — cockpit, wing, tail, booster, gear — and every variant in
the library is cut to the same socket, so any combination mates. Hulls themselves are
chains of sections joined by connectors, and the multi-hull chassis berths two, three
or four independent masses and links them with the same joint library.

The drawing is real orthographic projection with hidden-line removal: each ship is
tessellated once into a depth buffer, and every line is clipped against it, so nothing
shows through and draw order never decides what is visible. Shading is vector
hatching cut in each surface's own parameter space, clipped by the same buffer.

Output is pure vector throughout — the PNG and SVG exports are the same drawing.

## Controls

| | |
|---|---|
| `N` | new ship |
| `R` | reset the pictorial |
| drag | orbit the pictorial |
| rail | lock any slot and roll the rest |

## Running locally

Open `index.html`. That is the whole thing.

## Armada

`armada.html` musters the yard's output by the thousand — and no two ships in
the fleet are the same. Every hull is rolled from its own seed by the same
`buildShip`, forged in a pool of workers off the main thread, and scattered
at random through one flattened cloud, a hash grid keeping neighbours off
each other's hulls. The fleet bakes into merged spatial chunks — static
geometry, frustum-culled, two facet levels — so thousands of unique ships
draw in a few dozen calls, and any ship you fly up to is re-forged at full
facet count on the fly. 500 to 5,000 ships.

Every fleet also musters eight great ships built on the same joint library:
one 50-hull leviathan, two 25-hull dreadnoughts and five 10-hull ark
carriers — a central keel with further hulls berthed in rings around it,
each one its own section chain. The flag group rail names them.

Click any ship and the camera flies to her and holds her: drag orbits
around the hull, the wheel closes in. The card gives her designation,
dimensions, complement, a service record and the crew who hold her — every
word off the ship's own seed, so she tells the same story every time you
ask, and no two ships have led the same life. Click open space to release
her; the camera is free flight the rest of the time.

| | |
|---|---|
| click a ship | hold her: drag orbits, wheel closes in |
| click space | release |
| drag | look (free flight) |
| wheel / `W A S D Q E` | fly (`shift` boosts) |
| `N` | new fleet |
| `P` | palette |

## The Shoal

`armada-alien.html` re-binds the yard's forge to a hatchery: the same seeds,
workers and drawing, but every vessel is grown — eight body plans of ribbed
vertebral spines, membranes, scythes and tendrils, from plankton-small spore
mines to hive queens trailing beards of hook tentacles.

## The War

`armada-war.html` puts both fleets in one sky. They hyperspace in from
opposite sides and fight it out: squadrons dealt stratagems from Sun Tzu,
crown ships with a turret per hull and spinal lances, ion cannons that
charge before they speak, mines, seekers, gatling tracer, dogfights with
misses, and wreckage that carries the dead ship's momentum and litters the
field until the next war. The banner names the fleet that holds the sky.
