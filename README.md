# Orbital Yard

A procedural starship general-arrangement drawing, generated in the browser from a
seed. One self-contained HTML file, no build step, no dependencies.

**[Open it →](https://johnbr0phy.github.io/orbital-yard/)**

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
