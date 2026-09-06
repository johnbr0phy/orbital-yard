# Ship traffic, contacts and debris

The previous ship contact code tested capital hulls against a centre-based ellipsoid and eased penetrations out gradually. Coincident centres could bypass correction entirely. Wreck contacts used only a small radius around the fighter's centre and capped correction at four units; an embedded hero could remain trapped. Deep overlap also caused automatic destruction in some cases.

Ship contacts now use oriented hull envelopes transformed by the same yaw, pitch and roll functions as the renderer. A separating-axis test covers all 15 box axes. Translation is swept between simulation positions to catch ships crossing completely through another hull during a tick. Spatial broad-phase radii conservatively enclose rotated corners. Two solver passes perform mass-weighted separation and remove closing velocity. Overlap correction itself causes no damage; sufficiently fast swept impacts can damage a ship. Heroes obey the same contact rules. Ship–wreck contacts use the same complete-envelope correction.

These are conservative boxes around the rendered hulls, not triangle-level or compound per-component colliders. Continuous collision covers translation with the current orientation; it is not an exact continuous rotational mesh solver. Sparse appendages can therefore have extra clearance. Predictive avoidance reduces the need for visible corrections.

Pilots check future relative movement at 5 Hz, with five seconds of lookahead for small ships and sixteen for capitals. Nearby potential crossings trigger early braking and a persistent passing side above/below the obstruction. Relative-motion prediction includes incoming debris moving across the forward corridor. Actual capital movement and fighter steering both consume these routes and speed limits. Player-controlled ships receive contact resolution without AI steering overrides.

Existing debris-clearing weapons retain barrel alignment, line-of-fire blockers and physical impact checks. Predicted wreck threats now supply clearing targets as well. Large intact disabled hulks are avoided instead of being treated as easy fighter targets. Destroyed small mesh fragments can split into three smaller pieces, at most two generations. Splitting is restricted to bounded source meshes and respects the shared 192-object limit, 64-item upload queue and four uploads per tick. When those limits are reached, the existing dust fade is used.

Validation: rotated overlapping destroyers, coincident centres, separated thin hulls, complete between-tick crossings, hero escape from an embedded wreck, head-on capital avoidance, incoming lateral debris, and finite bounded fragmentation. Existing debris momentum, firing/blockers, fracture, weapon, helm, world-flight and camera regressions also pass. No full-density GPU performance claim is made.

## Star Destroyer helm and debris shields

Imperator, Victory, Tector and Executor hulls now use steady capital handling: slow cruise, capped turning, no transit sprint, zero bank target and a damped pitch limited to about 1.4 degrees. Arrival handling includes destroyers forged outside the crown slots. Collision braking cannot turn near-zero forward velocity into a sudden large pitch.

Their 5 Hz clearance scan covers the full hull width and 500 m or more ahead. Slow fragments are targeted with real, aligned weapons, including pieces excluded by the fighter size limit. Living ships still block clearance fire. Incoming fragments closing faster than 65 m/s are left to the shields. Swept contact with the shield envelope disintegrates fragments without position/velocity impulses, hull damage or additional solid fragments. A capped local blue flash and dust use the existing effect buffers. Whole disabled ships larger than the shield allowance still require gradual avoidance. Ship-to-ship collision detection remains active.

Eight `destroyer-coast.test.cjs` checks cover corridor width, fast incoming debris, swept shield impact without recoil, false contacts / oversized hulks, attitude stability while braking, cruise/hero handling, real clearance projectiles and continuous render poses. Traffic, debris, weapon, player-fire and new-fleet regressions also pass.

## Battle-flow correction

The first traffic pass competed with the older debris sidestep controller, replaced combat destinations, and reduced speed to 8% (then another 10% after contact). Its instantaneous pitch calculation magnified braking into nodding. Capital AI equipment also overwrote the intended destroyer cruise limits.

The swept traffic pilot now owns avoidance during normal simulation. Capitals retain their combat heading and request only a temporary passing altitude. The passing direction and clearance are held through each manoeuvre. Braking is graduated to 40–90%, contact recovery retains 65%, and collision impulses cannot reverse a ship or inject unbounded climb speed. All capital pitch changes are damped and capped; Marine heavy ships stay level. AI equipment preserves steady-capital cruise and turn limits. Solid swept contacts, destroyer shields and debris fragmentation remain active.

Regression checks include real spawned destroyer limits (after AI equipment), near-zero-speed attitude stability, preservation of combat heading, head-on clearance and embedded fighter escape.
