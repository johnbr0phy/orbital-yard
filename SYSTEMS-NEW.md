# Tribute New star systems

Each new battle generates a seeded background: giant sun, five worlds, ringed kingdom, binary dawn, ocean frontier, ice giant moons, eclipse, or ember worlds. Planet colors, surface bands, rings, moons, star colors and positions vary. Secondary worlds cover reverse and overhead views.

Celestial positions follow camera translation, keeping distant worlds prominent. Their depth buffer is cleared before battle geometry so scenery cannot obscure ships. Surfaces use one procedural shader; static meshes are built once per battle and disposed on regeneration. Systems stay below 40,000 celestial triangles, including rings and solar halos.

Validation: seeded generation across 200 systems, layout coverage, geometry bounds, battle regeneration integration, existing watch/rendering/effects/weapons checks, and isolated WebGL previews of giant sun, ringed kingdom and five worlds. Full-battle GPU performance was not benchmarked.
