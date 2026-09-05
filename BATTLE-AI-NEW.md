# Fleet minds for the tribute simulation

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
