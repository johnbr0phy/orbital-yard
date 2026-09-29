# Tribute War performance

**None of these numbers come from a real GPU.** This environment has no GPU. Every browser number below comes from headless Chromium rendering with **SwiftShader**, a software rasteriser running on the same 4-core Intel Xeon @ 2.10 GHz as the simulation (the script records the renderer string: `ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)))`). Software rendering makes every pixel-heavy feature look far more expensive than it is on a GPU, and it steals CPU from the simulation and the forge workers.

**No 60 FPS claim is made.** The CPU-only numbers (headless simulation and forge) don't depend on the rasteriser and carry over to real machines, scaled by CPU speed.

To produce the missing numbers on real hardware:

```
NODE_PATH=$(npm root -g) node scripts/bench-tribute.cjs --headed --sizes 200,600,1200 --seconds 30 --tier high --out bench/gpu.json
```

## Method

`scripts/bench-tribute.cjs` runs every battle the same way:
- **Fixed setup:** seed 1234, Empire vs Rebels, and a battle size taken as total ships (per fleet = size/2, then cut by each fleet's muster rules to 192 / 572 / 1,142 ships).
- **Viewport:** 1280×720.
- **Scripted camera:** a wide orbit for 0–10 s, a medium pass for 10–20 s, then a close hold on the largest ship.
- **Measurement window:** 30 s of battle after the war clock starts.
- **Frame times:** `requestAnimationFrame` deltas.
- **Per-frame splits:** timed by wrapping the page's own functions (`frame`, `simStep`, `collide`, the traffic pilot, the AI, `onWorkerMsg`).
- **Long tasks:** counted with `PerformanceObserver('longtask')`.
- **Heap:** read from `performance.memory`.

"Before" is the page at commit `7d08976`, served beside the same scripts. The same script was used for both.

The in-page `?perf=1` overlay shows the same splits live: sim / AI / collision / prediction, forge, render submit, and GPU time where `EXT_disjoint_timer_query_webgl2` exists (it does not under SwiftShader). It also shows draw calls, triangles, ships, rounds, effects, debris and heap.

## Browser frame times (SwiftShader, software)

| page | ships | FPS | p50 ms | p95 ms | p99 ms | main-thread JS ms/frame | war running (s) | first ship (s) | sim-s per wall-s | long tasks in arrivals | max long task ms |
|---|---|---|---|---|---|---|---|---|---|---|---|
| before | 192 | 6.7 | 150 | 217 | 250 | 9.2 | 2.7 | 3.9 | 0.43 | 108 | 260 |
| before | 572 | 4.9 | 133 | 467 | 500 | 9.2 | 6.4 | 7.7 | 0.20 | 58 | 514 |
| before | 1142 | 4.1 | 117 | 700 | 750 | 11.3 | 11.6 | 13.3 | 0.17 | 52 | 756 |
| after, Low | 192 | 7.2 | 133 | 167 | 200 | 11.8 | 2.1 | 4.2 | 0.46 | 111 | 299 |
| after, Low | 572 | 6.0 | 167 | 200 | 233 | 16.8 | 4.1 | 6.3 | 0.27 | 93 | 364 |
| after, Low | 1142 | 5.2 | 200 | 233 | 267 | 23.3 | 5.9 | 8.6 | 0.24 | 88 | 803 |
| after, High | 192 | 3.1 | 300 | 433 | 483 | 8.1 | 2.4 | 6.7 | 0.20 | 56 | 587 |
| after, High | 572 | 2.4 | 283 | 883 | 917 | 9.9 | 4.4 | 8.7 | 0.15 | 52 | 910 |
| after, High | 1142 | 2.2 | 300 | 1200 | 1233 | 13.6 | 6.7 | 11.1 | 0.14 | 52 | 1230 |

How to read it:
- **Low tier beats the original page at every size, even in software.** Low still has the HDR target, bloom, auto-exposure, grade and FXAA, but no MSAA and no nebula.
  - FPS: +7% at 192 ships, +22% at 572, +27% at 1,142.
  - p95: −23%, −57% and −67%.
  - The dynamic resolution scaler (floor 0.6 on Low) and the removed per-frame allocations account for the steadier tail.
- **High halves the frame rate in software.** 4× MSAA on a half-float target, a 5-level bloom chain, the procedural nebula and FXAA are all CPU work under SwiftShader. On a GPU they're a few fullscreen passes. No GPU number exists to justify High's cost against the 1 ms rule, so **auto-detection sends software renderers to Low**, and weak or mobile GPUs start at Medium (`guessTier`). The two-second probe then steps down further if frames miss their budget.
- **War running** is the time from `startWar()` until every hull is forged and the war clock runs: 2.7 → 2.1 s, 6.4 → 4.1 s, and 11.6 → 5.9 s.
- **First ship** also waits for the first arrival's sim delay, and in software at 3–7 FPS the sim advances only 2 steps per frame. That's why it looks worse than "war running" and, at High, worse than before. It's a frame-rate artefact of software rendering, not forge time.
- **Long tasks.** In software the rAF task itself is a long task, because GL calls wait on the rasteriser. So neither these counts nor the "no long task over 50 ms" target can be judged here. The forge now streams in batches of 6–12 hulls instead of one message carrying the whole muster.

## Simulation CPU (headless Node, same V8, no rendering)

Harness: `tests/tribute-new/headless-battle.cjs` (real forge, box collision meshes). Empire vs Tesla at 300 per fleet (572 ships), measured over simulated seconds 8–18.

| build | ms CPU per simulated second | notes |
|---|---|---|
| before (this pass's baseline) | 3,118 | matches PERFORMANCE-NEW.md's 3.06 s |
| swept prediction broad phase | 2,385 | traffic pilot 10.1 s → 2.8 s per 10 simulated s |
| + numeric cell keys in the spatial index | 2,196 | −30% total |

A recorded three-battle state trace (Empire/Rebels 150, Borg/Federation 80, Shadows/Minbari 60) is **byte-identical** before and after these changes.

The simulation still dominates. Combat-phase cost (simulated seconds 38–48, Empire vs Rebels) after the changes:

| ships | ms CPU per simulated second |
|---|---|
| 100 | 575 |
| 192 | 978 |
| 287 | 1,691 |

The frame gives the simulation 10 ms and up to 2 steps (8 at 4×). On this CPU, a battle above roughly 150 ships therefore runs slower than real time while keeping the frame responsive. Default battle size follows the quality tier: 50 / 100 / 150 / 300 a side. See DECISIONS.md for why the sim wasn't moved to a worker and what the next structural steps would be.

## Forge CPU (single thread, 572 ships, Empire vs Rebels)

| build | ms | |
|---|---|---|
| before | 11,412 | `fractureMesh` was 66% of fighter forge time |
| `fractureMesh` rewrite (byte-identical output) | 8,785 | 3.4× faster on 40 random meshes |
| fire-hull BVH bounds without `Math.min` spread (byte-identical) | 7,093 | |

With the worker pool (`hardwareConcurrency − 1`, max 4) that CPU is split across cores. The muster ships to the page in 6–12 hull batches, capitals first.

## Memory

- **Five back-to-back wars** (60 a side, 20 s each, High), heap after a forced GC at the end of each war: 22.8, 22.2, 31.0, 18.0, 21.2 MB. The heap stays flat.
- **Replay memory.** The replay ring is 10 Hz × 20 s × ships × 8 floats. At 1,142 ships that's about 7.5 MB, plus capped weapon segments. Highlight clips copy only up to 160 nearby ships.

## Targets, honestly

| target | status |
|---|---|
| 60 FPS at 600 ships, 2020 integrated laptop | **Not measured** (no GPU). The CPU simulation alone exceeds a 60 FPS budget at 572 ships on this Xeon, so it would not be met without a structural simulation rewrite. |
| 30 FPS at 200 ships, mid-range phone | **Not measured.** Low tier and the 50-a-side default are aimed at it. |
| First ship < 2 s, playable < 5 s | War running in 2.1 s at 192 ships and 4.1 s at 572 (Low, software). First ship measured 4.2 s, dominated by software frame rate. **Not demonstrated** at < 2 s. |
| No long task > 50 ms in arrivals | **Not demonstrable** under software GL (every frame is > 50 ms). The forge streams in small batches. |
| Flat heap across five wars | **Met** (18–31 MB after GC, no trend). |

# Story pass: performance

All simulation numbers below are **headless Node, CPU only** (no rendering), on the same 4-core Intel Xeon @ 2.10 GHz, measured with the machine idle. Browser numbers are **software-rendered (SwiftShader)** and labelled so.

## Simulation CPU at 300 a side (572 ships)

`scripts/sim-bench.cjs --size 300`, Empire vs Rebels, seed 1234. "Before" is the baseline tree (commit `57ed33c`) measured in the same session, interleaved with "after", two runs each.

| window (war seconds) | build | ms CPU per simulated second | mean live ships in window |
|---|---|---|---|
| 38–48 | before | 3,672 / 3,642 | (462 alive at 38 s) |
| 38–48 | after | 2,612 / 2,675 | (562 alive at 38 s) |
| 30–90 | before | 2,769 / 2,785 | 330 |
| 30–90 | after | 2,955 / 3,067 | 489 |

How to read it: **the two builds don't fight the same war**, so a fixed window compares different moments. In the story build the fleets hold, flank or wait before they close, so at 38 s the after war is still mostly manoeuvring (cheap), and over 30–90 s it keeps 48% more ships alive (more ships to simulate). Per live ship over 30–90 s, after costs 6.2 ms against 8.4 ms before.

**The story layer's own cost** (`scripts/story-cost.cjs`, which times the page's `storyStep` inside `simStep`):

| war | story ms per simulated second | share of the simulation |
|---|---|---|
| 300 a side, 30–90 s | 22.3 | 0.79% |
| 60 a side, 20–120 s | 4.5 | 0.90% |

Squadron morale and capital crises are bucketed by ship id across steps; plans, objectives, rescues and ace duels run once a simulated second. The order checks inside each pilot's `think()` aren't separable and are counted as simulation.

## Refactor that had to stay byte-identical

- **Spatial-index cell keys wrapped to small integers** (`((x&1023)<<20)|((y&1023)<<10)|(z&1023)`), so V8 keeps them as small integers in the map. The three-battle state trace from `sim-bench.cjs --trace` is **byte-identical** before and after (`16ea5e01…`). A/B on the baseline tree: 3,804 → 3,639 ms per simulated second (−4%), measured under load at the time.

## Behaviour change, new trace

The story changes the war on purpose, so the trace changes. `bench/story/trace-before.txt` is the baseline (`16ea5e01…`). The story pass recorded `945a530c…`; the owner-feedback round (throttle, First Ones, Tyranid spores) changes the war again, and `bench/story/trace-after.txt` was `034d4243…`. The motion pass (MOTION.md) changes how every ship flies, so the war changes again on purpose: the trace is now `15001052…`, recorded twice with identical output, and `scripts/determinism-browser.cjs` still finds the same war however it is watched.

## Re-measured after the owner-feedback round

The throttle (ships speed up and slow down with the fight) changes the war itself: fleets close sooner, so by 48 s the 300-a-side war has lost 35 ships instead of 17. Measured interleaved in one session against the story-pass commit (`832363e`), `sim-bench.cjs --size 300`:

| window (war seconds) | build | ms CPU per simulated second | alive at start / mean alive |
|---|---|---|---|
| 38–48 | story pass | 2,870 / 2,863 | 562 / 557 |
| 38–48 | now | 3,363 / 3,436 | 556 / 544 |
| 30–90 | now | 3,337 / 3,296 | 571 / 490 |

- **The machine was about 9% slower this session** than when the tables above were recorded (the story pass measured 2,612–2,675 then, 2,863–2,870 now).
- **The rise is the war, not the throttle.** Timed directly inside the same window, `throttle` and `approachSpeed` cost 59 and 17 ms per simulated second (150,734 calls), about 2.4% of the simulation, and that includes the timer's own overhead. The rest is more fighting earlier.
- **The story layer stays under 1%:** `story-cost.cjs` gives 25.2 ms per simulated second (0.83%) at 300 a side over 30–90 s, and 4.7 ms (0.79%) at 60 a side over 20–120 s.
- **Battle size.** The reference costs below were not re-fitted. The page prefers its own measured wars over the probe when it scales them, and keeps 45% of the budget for rendering, so a war that costs about 15% more than the reference is absorbed after the first war on a machine.

## Cost by battle size (after, idle)

`sim-bench.cjs --size N`, war seconds 38–48. These are the reference numbers the page's battle-size choice scales from (DECISIONS.md, "Battle size").

| per side | ships | ms CPU per simulated second |
|---|---|---|
| 50 | 100 | 419 |
| 100 | 192 | 660 |
| 150 | 287 | 1,301 |
| 200 | 382 | 1,620 |
| 300 | 572 | 2,587 |
| 450 | 857 | 4,325 |
| 600 | 1,142 | 5,862 |

## Browser frame times (SwiftShader, software)

`scripts/bench-tribute.cjs --sizes 200,600 --seconds 30 --tier low`, before (baseline tree) and after, same session, same machine. **Software rendering: these are not GPU numbers.** Raw data: `bench/story/browser-before-low.json`, `bench/story/browser-after-low.json`.

| build | ships | FPS | p50 ms | p95 ms | p99 ms | sim-s per wall-s | war running (s) | max long task ms | heap at end MB |
|---|---|---|---|---|---|---|---|---|---|
| before | 192 | 7.58 | 133 | 167 | 217 | 0.49 | 2.3 | 278 | 58 |
| before | 572 | 6.15 | 150 | 217 | 250 | 0.28 | 4.1 | 329 | 131 |
| after | 192 | 7.63 | 133 | 167 | 200 | 0.50 | 2.3 | 260 | 40 |
| after | 572 | 6.26 | 150 | 217 | 250 | 0.28 | 4.1 | 322 | 116 |

No measurable change in software. The 30-second window is mostly arrivals and first contact, where the story layer does little; the headless numbers above cover the combat phase. No GPU was available here, so the GPU column the brief asks for is **not measured**; `--headed` on real hardware produces it.
