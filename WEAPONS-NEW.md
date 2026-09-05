# Tribute New weapons

The review page now separates fixed fighter guns, traversing batteries, held
energy beams and travelling rounds. Existing fleet personalities and decision
weights remain in place. Fixed-gun attack/flank passes briefly steer toward an
intercept point so the pilot can line up; retreat, escort and formation goals
retain their previous controller.

## Hardware and effects

- Small fighters use forward barrels, alternating the model's muzzle positions.
  A side/rear target does not permit a shot. Bolts leave along the hull axis.
- Larger ships and transport/Falcon classes use exposed mount hemispheres.
  Turrets acquire a direction at a finite traverse rate before firing. The
  visible barrels rotate with this same aim state. Naval cannons, energy
  emitters and organic nozzles use three shared meshes drawn with instancing.
  Their transformed tips are the shot origins; fixed fighters keep their
  original hull-mounted guns. Unique First One effects keep their bespoke
  emitters. Existing hull gun detail remains as the mounting structure.
  Subpixel barrels are omitted at distance; meshes are built once, not per frame.
- Empire/Rebel lasers, EarthForce pulses and Klingon disruptors are short
  travelling bolts. Federation phasers, Choir emission, Minbari neutron beams,
  Shadow slicers and Borg cutters use coherent beams. Defiant-class weapons
  use pulses. Size controls width and traverse speed; fleet controls colour
  and projectile speed.
- USCM/Drift kinetic bursts are staggered in time, with small angular dispersion.
  Shoal/Engineer/Yautja plasma retains splash damage with direct-hit detection.
  Procedural original fleets retain their seeded alternative weapons; tribute
  fleets use their signature hardware rather than random unrelated primary guns.
- Beams no longer fork midway. Filled ribbons have a coloured sheath and bright
  core. Held emissions follow both ships and expire when the emitter/target is
  lost. Bolts detach at launch and cause damage on collision, not at emission.
- Fast rounds sweep each simulation step against oriented hull envelopes.
  Target endpoints use hull proportions rather than a length-sized sphere.
  Envelopes approximate hull geometry; these are not per-triangle collisions,
  and friendly hull/debris obstruction is not newly modelled.
- Capital sensor coverage includes the ship's full half-length plus the sensor's
  reach, fixing a blind area at the bow of an Executor-sized hull.

Ion warnings and unique First One area/arc effects retain their distinct rules.
Weapon balance has changed because bolts now travel and fixed guns must align;
this is a review build, not a claim of equal fleet win rates.

## Bounded validation

`node --test tests/tribute-new/weapons.test.cjs` exercises geometry, fixed axes,
mount arcs, turret traversal, emission lifetime, detached bolts, sensor reach,
barrel geometry, fixed-gun preservation and agreement between barrel tips and
shot axes. Charged ion fire uses the barrel tip and waits for alignment; an
unreachable firing direction cancels the charge after a bounded grace period.
`node tests/tribute-new/weapons-smoke.cjs` uses one small forge and six simulated
seconds to check Executor firing, then six seconds at two rendering rates.
Run these serially with external wall timeouts. Do not run a WebGL preview at
the same time as simulation tests.

The preview now offers a 24-ship size setting, starts at 150 instead of 600,
and uses one forge worker. Actual fleet counts vary by fleet. These reduce
load; they do not guarantee system stability. After a reported machine crash,
validation deliberately excluded broad fleet stress/soak runs.
