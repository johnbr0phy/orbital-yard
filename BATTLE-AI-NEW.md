# Fleet minds for the tribute simulation

See [WEAPONS-NEW.md](WEAPONS-NEW.md) for the subsequent weapons overhaul,
small-fleet controls and current bounded validation limits.

`armada-war-tribute-new.html` loads `armada-battle-ai-new.js` beside it. Keep both files
when copying or publishing this variant. There are no packages or build steps
for the playable page. The other Armada variants keep their existing behaviour.

## What changes in a battle

Every ship receives a stable pilot and a weapons / armour / engines allocation
that totals 100. Weapon investment changes damage and gun recovery, armour
changes integrity and damage resistance, and engines change speed and turning.
Skill, aggression, courage, discipline, cooperation and creativity vary around
the fleet's profile. Luck makes a small, bounded contribution to hit probability.

Confidence and fear change with nearby strength, isolation, damage and success.
Pilots commit to an action for several seconds, with emergency overrides for
heavy damage and ion warnings. They attack, flank, escort damaged allies,
regroup, withdraw, evade or search. An ace follows these same rules.

Watching allies die nearby adds shock, which fades over a few seconds and
feeds fear whatever the enemy's range. A shocked pilot drops posture orders
(hold, hide, manoeuvre, guard) and picks fight or flight: charge the killer at
full burn, or scatter away from it on its own line. Courage, aggression and
doctrine weight the choice; fleets that never retreat always charge. Any loss
to enemy fire also releases the side's plan posture, so a fleet never holds a
parade line while something out of range picks it apart.

Sensors have a range, view angle, scan interval and contact limit. Pilots retain
last observed positions, predict briefly, and eventually forget. Nearby allies
can share observations, preserving the original observation timestamp. A cloak
can be detected at very close range. Sensors currently model range, angle and
cloaking; hulls and debris do not yet occlude sensor rays.

Capital ships actively turn, climb, make attack passes and reposition around
allies. A sustained transit burn closes the distance from a distant muster
position and sheds speed on sensor contact. Ordinary large hulls, including Shadow battlecrabs, use the capital
controller even when the muster files them outside the multi-hull classes.
Gun range accounts for a capital's own hull, so a long ship can fire beyond its
bow. Large ships retain their existing models and distinctive weapons.

Ion cannons charge for 4.2 to 5.4 seconds and mark a fixed firing zone. A pilot
who knows about the firing ship can break out of that zone. The cannon fires
where it committed, has a longer recovery, and causes bounded damage plus a
temporary engine disruption. It cannot remove a healthy hull with one hit.

Heroes retain modest advantages in skill, integrity and mobility. The previous
stack of health, damage, damage resistance, range and firing rate multipliers
is removed. First One area attacks are bounded too; overlapping chain bursts
cannot damage the same ship repeatedly in a single activation.

Select a ship to see its allocation, traits, confidence, fear, current reason
and contact counts. **SHOW SENSORS** draws its horizontal view sector and links
to contacts. Solid links indicate observations; broken links indicate memory
or reports. The overlay is a horizontal guide to a three-dimensional sensor.

## How the ships fly: handling and the helm

The fleet minds decide *what* to do. Since the motion pass (MOTION.md), a second table and a layered controller decide *how* each ship flies it. Both live in `armada-battle-ai-new.js`, and the page calls them for every small craft and capital.

### Handling per fleet

Each fleet has a handling row beside its pilot profile. Each pilot draws their own values around the row from a random stream seeded by their own hull. Nothing else reads that stream, so a squadron shares a style but never a stick. Spreads per pilot: ±0.12 on smoothing, ±0.18 on bank, ±0.15 on overshoot, weave and re-forming, ±0.10 on tightness, ±0.20 on breaking away, ×0.6–1.4 on reaction delay, ×0.7–1.35 on rhythm frequency and depth, ×0.7–1.4 on weave frequency. **These are game rules, my readings of how each fleet is portrayed on screen, not claims about canon.**

- **Formation**: the shape its fighter squadrons fly. Frigate squadrons always fly a line-ahead column.
- **Attack**: preferred attack geometry. *Slash* works a wide circle and extends long after a pass. *Joust* closes tight and extends short. *Orbit* circles wide. *Dive* comes in from above. *Stalk* comes in from astern. *Swarm* comes in from each pilot's own bearing.
- **Stick smoothing** sets the yaw response time (0.32 + 0.5 × smoothing s, longer for bigger hulls).
- **Bank**: how far a pilot rolls into a turn.
- **Overshoot**: the tolerance for swinging past a heading (damping 1.05 at 0, 0.70 at 1).
- **Throttle rhythm**: the frequency and depth of the pilot's own feathering on the throttle.
- **Tightness**: formation spacing.
- **Breaks away**: willingness to leave the formation to cover a damaged friend.
- **Re-forms**: how soon after a fight the squadron re-forms, and how hard wingmen close.
- **Reaction**: the delay before a new demand reaches the stick.
- **Weave**: stick weave depth and frequency.
- **Commitment**: the hysteresis margin and dwell time before a pilot changes its mind.

| Fleet | Formation | Attack | Stick smoothing | Bank | Overshoot | Throttle rhythm (Hz / depth) | Tightness | Breaks away | Re-forms | Reaction (s) | Weave (depth / Hz) | Commitment | Why |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Yard | finger-four | slash | 0.6 | 0.75 | 0.3 | 0.16 / 0.055 | 0.78 | 0.3 | 0.7 | 0.34 | 0.3 / 0.5 | 0.55 | A drilled yard navy flies the textbook: clean banked turns, fingers held, passes by the manual. |
| Shoal | swarm | swarm | 0.22 | 1.15 | 0.8 | 0.42 / 0.1 | 0.3 | 0.75 | 0.4 | 0.2 | 0.9 / 0.95 | 0.25 | A social swarm: quick hands, big swings past the mark, surging together like a current. |
| Lattice | line abreast | orbit | 0.85 | 0.45 | 0.08 | 0.1 / 0.045 | 0.95 | 0.08 | 0.95 | 0.4 | 0.1 / 0.3 | 0.8 | A coordinated lattice: exact rails, almost no weave, the line snaps back at once. |
| Drift | cluster | stalk | 0.5 | 0.8 | 0.6 | 0.3 / 0.08 | 0.5 | 0.5 | 0.5 | 0.48 | 0.6 / 0.7 | 0.4 | Salvagers: loose and wary, always ready to slide off the line and come back. |
| Choir | wedge | orbit | 0.9 | 0.6 | 0.25 | 0.07 / 0.07 | 0.75 | 0.3 | 0.6 | 0.6 | 0.35 / 0.25 | 0.6 | A patient choir: long slow swells on the throttle, silky turns. |
| Empire | wedge | joust | 0.42 | 0.78 | 0.14 | 0.2 / 0.05 | 0.9 | 0.1 | 0.9 | 0.24 | 0.14 / 0.6 | 0.7 | Drilled aggression: crisp and precise, tight wedges, straight in and re-formed fast. |
| Rebels | finger-four | slash | 0.5 | 1 | 0.62 | 0.26 / 0.08 | 0.52 | 0.78 | 0.55 | 0.3 | 0.65 / 0.8 | 0.35 | Creative and loose: deep banks, wide fingers, quick to break off and help a friend. |
| Minbari | wedge | slash | 0.88 | 0.55 | 0.05 | 0.09 / 0.05 | 0.85 | 0.2 | 0.8 | 0.3 | 0.08 / 0.35 | 0.75 | Composed and exact: no wasted motion, long clean passes, nothing swings past the mark. |
| Shadows | swarm | dive | 0.2 | 0.3 | 0.72 | 0.45 / 0.12 | 0.35 | 0.6 | 0.5 | 0.16 | 0.8 / 1.1 | 0.4 | Chaos with a purpose: sudden surges and swoops, little bank, predatory dives. |
| EarthForce | finger-four | slash | 0.6 | 0.72 | 0.3 | 0.18 / 0.055 | 0.8 | 0.35 | 0.75 | 0.34 | 0.3 / 0.55 | 0.55 | EarthForce flies by the book and holds its fingers. |
| Federation | line abreast | orbit | 0.75 | 0.6 | 0.2 | 0.12 / 0.055 | 0.75 | 0.45 | 0.7 | 0.4 | 0.25 / 0.4 | 0.55 | Measured and aware: wide orbits, a steady rhythm, peels off to cover a friend. |
| Klingons | wedge | joust | 0.35 | 0.9 | 0.5 | 0.32 / 0.09 | 0.6 | 0.5 | 0.45 | 0.2 | 0.3 / 0.65 | 0.95 | They commit and do not look back: long dwell on a choice, hard banks, surging burns. |
| Borg | cluster | joust | 1 | 0 | 0 | 0.05 / 0.045 | 0.95 | 0 | 1 | 0.7 | 0 / 0.2 | 0.9 | Cold, unhurried certainty: no bank, no weave, no overshoot, a slow even pulse. |
| Mondoshawan | line abreast | orbit | 0.85 | 0.5 | 0.2 | 0.08 / 0.06 | 0.8 | 0.3 | 0.7 | 0.55 | 0.2 / 0.3 | 0.6 | A protective convoy: slow, careful, wide turns. |
| USCM | finger-four | slash | 0.5 | 0.8 | 0.25 | 0.22 / 0.055 | 0.8 | 0.35 | 0.8 | 0.26 | 0.3 / 0.6 | 0.6 | Marines: skilled and disciplined, sharp fingers, quick re-forms. |
| Engineers | cluster | dive | 0.8 | 0.4 | 0.3 | 0.1 / 0.07 | 0.6 | 0.3 | 0.6 | 0.45 | 0.2 / 0.3 | 0.65 | Inventive and composed: slow deliberate dives, little bank. |
| Yautja | swarm | stalk | 0.5 | 0.9 | 0.4 | 0.24 / 0.07 | 0.35 | 0.8 | 0.35 | 0.2 | 0.5 / 0.7 | 0.7 | Hunters: independent loose packs that stalk from behind and commit. |
| First Ones | cluster | orbit | 1 | 0.2 | 0 | 0.04 / 0.04 | 0.5 | 0.5 | 0.5 | 0.5 | 0 / 0.2 | 0.9 | Ancient and absolute: they move as if nothing can touch them. |
| Romulans | wedge | stalk | 0.65 | 0.6 | 0.28 | 0.14 / 0.06 | 0.7 | 0.3 | 0.7 | 0.3 | 0.25 / 0.45 | 0.6 | Patient ambushers: smooth, controlled, quick to slip away. |
| Dominion | line abreast | joust | 0.5 | 0.7 | 0.3 | 0.2 / 0.055 | 0.85 | 0.15 | 0.8 | 0.25 | 0.2 / 0.55 | 0.8 | Relentless: straight lines in, no hesitation. |
| Space Marines | wedge | joust | 0.4 | 0.6 | 0.2 | 0.18 / 0.05 | 0.85 | 0.2 | 0.85 | 0.28 | 0.15 / 0.5 | 0.8 | Fearless and drilled: tight wedges, straight at the enemy. |
| Tyranids | swarm | swarm | 0.3 | 0.4 | 0.9 | 0.4 / 0.12 | 0.28 | 0.55 | 0.6 | 0.25 | 1 / 0.9 | 0.3 | The swarm: organic weaving and wild overshoots; synapse pulls it back together. |
| Tesla | finger-four | slash | 0.4 | 1.2 | 0.45 | 0.3 / 0.08 | 0.6 | 0.5 | 0.6 | 0.22 | 0.5 / 0.85 | 0.4 | A startup fleet: fast hands, eager banks, improvised lines. |


### The helm, bottom to top

1. **Physics limits by hull.**
   - Turn rate, spool and top speed come from the forge and the engines allocation.
   - No hull of 40 m or more turns inside a circle proportional to its own length, at any speed: 1.4 lengths for a frigate, corvette or transport, 0.9 for a slicer or cutter small craft, 0.8 for light craft and heroes. A slow ship turns slowly instead of pirouetting. Frigates are also held to that circle at cruise.
   - No ship climbs or dives much steeper than about 30° to its own flight path, unless it is lining up a shot or avoiding an imminent collision.
   - Any hull of 80 m or more turns at no more than 0.08 rad/s below 20% of top speed. Nothing that size pivots on the spot.
   - Angular acceleration and angular jerk are limited by the pilot's response time.
   - Speed changes through an acceleration that builds under a jerk limit, inside the spool: 1.5 s for fighters, 4 s for mid-size ships, 8–30 s for capitals, and braking 1.5× quicker. A transit burn builds and sheds over the same spool, against its own full burn.
2. **The pilot filter.**
   - The pilot sees a new *intent* (a point in the world) late, by their own reaction delay. The delay never sits on an aim computed from the ship's own position, so it cannot make the ship oscillate.
   - The stick follows the heading error through the pilot's response time and damping.
   - The weave rides on top (never on a frigate: that is what made them nod).
   - The ship banks into the turn through a critically damped roll.
   - Climb and pitch are second-order. The altitude the pilot steers for is smoothed over about 1.5 s, so a sensor refresh on the mark does not make it porpoise.
   - Traffic avoidance blends in over 0.35 s and out over 4 s. A ship that climbed over traffic eases back instead of hopping.
   - The throttle carries the pilot's rhythm.
3. **Intent.**
   - The goal comes from the minds, with hysteresis. A new goal has to beat the current one by a margin (0.06 + 0.14 × commitment) and keep beating it for a dwell that grows with the hull: 0.5 s + length / 120 m, capped at 5 s, × (0.6 + 0.8 × commitment), × 1.4 for crowns. Being hit hard (12% of the hull in one decision), terror, a crippled hull or an ion lock override it.
   - Every goal change is logged on the pilot (`ai.goalLog`) with its reason.

### Stations, orbits and lines

- **No point is ever held by flying at it.** Near a point it must hold, a fighter orbits it on a lazy circle (no faster than 0.5 rad/s), and a formation leader slower still. A frigate flies a racetrack across the enemy's line, with legs several turning circles long and wide banked arcs at the ends.
- **The direction is chosen from how the ship is already moving**, so arriving is never a reversal.
- **The circle's size comes from the hull and the loiter pace, not the current speed.**
- **Attack standoffs are orbits** around the target at the pilot's own range, flown at the pilot's own pace (95% of cruise, 75% for a frigate). A pilot never matches a slow target's speed down into a pirouette.
- **Screens circle the threat side of their capital.**
- **A capital holding a point** runs its way in, brakes over its spool and stops. It does not circle or pivot.

### Living formations

- **Every squadron has a leader and a shape**: its fleet's for fighters, a column for frigates, and about a length and a half of spacing for cruisers.
- **Slots sit on the leader's own recent track**, set back by the slot's depth and out to the side of the track's direction there. In a turn the squadron flows round the curve like lanes on a road, instead of pivoting like a plank. Each pilot's slot carries its own offset and a slow breathing, and each wingman wanders a few degrees on the line.
- **The formation's turn rate is capped by its width**, so the outside lane never needs more than 35% more speed. The leader flies no faster than the slowest wingman allows.
- **Phases:**
  - FORM: after the jump.
  - CRUISE: at least three quarters of the wingmen are in their slots.
  - BREAK: the leader, or a third of the squadron, is within fighting range of its target.
  - REFORM: after 2–9 s of calm, by the fleet's re-form value.
  - Frigate columns never break: they fight as a line.
- **Wingmen keep station on the slot's velocity**, corrected toward the slot. A wingman ahead of its slot eases off and never turns round for it. One far off flies an intercept that slows as it arrives.
- **A pilot hit, evading an ion lock, on its own order** (a ram, a tow, a rescue of pods), on a vendetta, in its own fight or flight, or breaking away to cover a damaged friend leaves the formation. It rejoins afterwards.

## Fleet profiles

Profiles are deliberately overlapping distributions, not rules that force every
pilot of a race to act identically. Hardware and existing weapon differences
still matter. These are simulation design choices rather than canonical stats.

| Fleet | Predisposition | Capital approach |
| --- | --- | --- |
| Yard | Disciplined cooperation | Broadside passes |
| Shoal | Aggressive, social, impulsive | Close swarming |
| Lattice | Accurate, coordinated, methodical | Encirclement |
| Drift | Cautious and inventive | Skirmishing |
| Choir | Patient and cooperative | Supporting positions |
| Empire | Aggressive, disciplined | Siege positions |
| Rebels | Creative, skilled, cooperative | Flanking |
| Minbari | Accurate, composed, long sight | Flanking |
| Shadows | Aggressive and unpredictable | Pouncing |
| EarthForce | Disciplined, protective | Broadside passes |
| Federation | Cooperative, measured, aware | Supporting positions |
| Klingons | Aggressive and courageous | Pouncing |
| Borg | Coordinated, steady, wide sight | Encirclement |
| Mondoshawan | Courageous, protective, heavily armoured | Supporting positions |
| USCM | Skilled, disciplined, cooperative | Broadside passes |
| Engineers | Inventive, composed | Encirclement |
| Yautja | Skilled, independent, narrow forward sight | Ambush angles |
| First Ones | Skilled, composed, wide sight | Changing attack angles |

## Checks and reproducibility

Run with Node, without installing dependencies:

```sh
node --test tests/tribute-new/battle-ai.test.cjs
node tests/tribute-new/fleet-balance.cjs
```

The regression suite checks all 18 pilot generators, body budgets, limited
perception, fading reports, fear and recovery, hero damage, fixed ion locks,
reinforcements, inspection controls, restarts and different render rates.

The matchup suite runs the actual page's forge, setup, movement, weapon,
damage and collision functions across nine pairings covering every fleet.
It checks finite state, engagement, multiple decisions and movement of surviving
capitals. Its small-fleet results are diagnostic, not evidence of equal win rates
across the 153 possible distinct pairings and all fleet sizes.

The headless harness replaces WebGL and DOM operations with inert objects.
Hull dimensions, mounts and classes come from the actual procedural forge;
tessellation uses bounding boxes for the generated parts. These are combat and
integration checks, not a visual browser test or a GPU frame rate measurement.

Combat advances at 30 fixed steps per second. Cosmetic randomness does not
consume the combat or debris streams. Initial forging pauses that clock, and
the worker's band cache resets between battles. Identical seeds and setup
repeat under the same worker configuration and arrival scheduling; asynchronous
reinforcement forging and different worker counts can still change outcomes.

The profile table and decision weights live in `armada-battle-ai-new.js`. Keep
balance tuning there and use the real battle tests when changing weapon
adapters in the HTML. Breeding pilots between wars remains a later feature.
