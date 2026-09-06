# Tribute New destruction and debris

Large ships can now become **disabled drifting hulks** or suffer **catastrophic breakup**. Disabled ships leave the fight immediately: no engines, maneuver orders, turrets or active weapons. Their existing hull mesh becomes an obstacle. Further weapon damage can break a disabled hulk apart. Severe overkill forces a catastrophic result; otherwise large-ship outcomes vary deterministically with the battle's debris random stream. Small craft break up directly.

## Root cause and motion

The old contact response multiplied debris spin by up to 1.06 on every ship-contact tick. Sustained contact therefore caused exponential rotation growth. It also added velocity without accounting for either body's mass or an equal reaction. A minimum-speed rule injected fresh velocity into stationary debris.

Those rules are removed. Contact now transfers momentum according to approximate volume-based masses. Rotation has a scale-dependent limit (maximum surface speed approximately 10 model metres/second, at most 0.65 radians/second) and a small exponential damping term. The angle integrates that damping analytically, so changing the update interval does not change the total rotation. Linear drift is preserved, including zero velocity. Queued fragments begin at the position and orientation appropriate to their elapsed time when uploaded.

This is a stable game approximation, not a general rigid-body solver. Damping represents settling tumble for readability; no claim is made that isolated rigid bodies lose angular momentum in a vacuum. Collision masses approximate geometry volume, not canonical ship mass. Collision envelopes are coarse, especially between two irregular wrecks.

## Breakup and cost limits

Catastrophic large-ship breakup spatially partitions actual hull triangles, independent of the original procedural component groups. Long triangle edges are subdivided before grouping, so the surface can fracture across a large hull panel. This allows more pieces than the forge's previous 2–12 component groups, even where the original object is built from a few large components.

- Up to **32** fragments per large catastrophic breakup; up to **6** for small craft.
- Up to **8,192** triangles processed per breakup; no unbounded re-tessellation.
- At most **4 mesh uploads per simulation step**, **64 queued fragments**, and **192 total live/queued debris pieces**.
- At most **24 disabled hulks**. Their existing GPU meshes are transferred, not duplicated.
- Fragments fade to dust after **45–80 seconds**; untouched hulks after **180 seconds**. Damaged pieces can disintegrate sooner.
- Dust is capped at **1,800 particles**. Excess breakup demand becomes bounded dust rather than additional geometry.
- Existing frustum culling remains. The single forge worker remains unchanged.

Fragments are surface clusters, not individually watertight solids with modeled interiors. The model does not simulate reactor interiors or chain-reaction physics. Disabled hulks expire to bound long battles; this is a gameplay/resource rule.

## Navigation and clearing

Pilots inspect the projected corridor ahead, including hull reach and relative debris drift, before contact. Threats produce a detour and braking. A short-lived committed waypoint prevents steering from flickering back to the enemy as soon as the immediate collision line clears. Capitals use the same clearance goal and reduce their transit speed.

Ships can deliberately clear sufficiently small obstructing pieces. Fixed weapons still require forward alignment. Turrets still traverse and fire from their visible barrel tips. Bolts use the normal projectile colors/speeds and apply damage only on swept impact; beams intersect the obstacle and stay attached to their firing mount. A living ship in the firing corridor suppresses deliberate clearing. The selected ship's status distinguishes avoiding a hulk, passing debris and clearing debris.

Ordinary tracer/energy rounds, plasma rounds and coherent `fireBeam` shots can also strike intervening debris. Special faction area effects, missiles and bespoke rail/ion attacks have not all been generalized to debris. Clearing favors small pieces; ships navigate around intact large hulks rather than trying to erase them with fighter guns. Path selection is local avoidance, not a globally optimal route through an arbitrary dense field.

## Bounded validation

All checks ran serially with a 256 MB Node heap and an 8-second wall timeout per process; no browser workload overlapped them.

- Eleven focused debris checks pass: rate-independent angle integration at 20/30/120 Hz; no artificial minimum speed; contact momentum and spin bounds; early large-obstacle detection; actual forward-bolt impact; off-axis and friendly-blocker rejection; beam/barrel alignment; disabled-to-breakup transition; queue/count/lifetime limits; actual destroyer-mesh fracture; ordinary beam obstruction; upload-time pose continuity.
- A real destroyer mesh produced 32 finite clusters / 1,680 triangles in the tested case.
- One moving fighter and one hulk, six simulated seconds: fighter survived, minimum center clearance approximately **83 m**, and flew a roughly **100 m lateral detour**.
- All eighteen existing weapon regression tests pass.
- Small Executor firing and 30/120 FPS simulation-state checks pass.
- Fighter checks retain **13 shots** in the controlled duel and **31 shots / seven survivors** in the eight-fighter case.
- All 57 model-study mesh checks pass; ship geometry and materials were not changed in this pass.

These are focused physics/logic and geometry checks. No full-fleet stress test, long GPU soak or comprehensive balance evaluation was run. More and longer-lived obstacles can change battle outcomes.


## Bounded death effects and exhaust

Thermal ruptures cool from a brief bright core to uneven orange ejecta; reactor failures bloom blue, Shadows dissipate in violet, Borg discharge green, and Minbari/Engineer failures produce cold flashes. Existing class death sequences now use these distinct shaders. Death sparks travel outward as short fragments rather than stationary rays.

Exhaust comes from authored Rebel bells and Earthforce/CR90 drive assemblies, follows the ship pose, and grows with speed. Unsupported outlets receive no guessed plume. Organic ships get no rocket exhaust. Outlet discovery happens in the forge worker.

Hard limits: 224 queued flashes, 192 engine sprites, 15 outlets per hull, subpixel exhaust culled. Both effects share one existing sprite draw and reusable buffer. Standard explosion sprites are capped at 240 pixels; engine glow at 72 pixels. No new debris physics, texture loads or simulation particles. Budget and combat regressions pass; the shader was inspected with an 18-sprite isolated preview. Large-fleet GPU frame rate has not been benchmarked.
