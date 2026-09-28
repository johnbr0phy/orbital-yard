# Tribute War audio: measurements

This file is the evidence for the sound of `armada-war-tribute-new.html`. Every number
here was measured from the page's real audio output, rendered by headless Chromium.
Nothing in it is estimated by ear, because I can't listen in this environment.
The owner judges by ear in `audio/scenes.html`.

## How scenes are captured

- **The scene set.** `bench/audio/scenes.json` holds ten scenes: a seeded war, a start
  time and a scripted camera. Cameras are computed from probed trajectories
  (`scripts/audio-probe.cjs`, then `scripts/audio-pick-scenes.py`), so the fighter really
  passes 31 units from the parked camera at the moment the script says it will.
- **Sound.** `scripts/capture-audio.cjs --scene N` runs the page's own audio engine on an
  `OfflineAudioContext`. It suspends the render every 1/30 s, steps the war through the
  page's war clock, moves the camera, runs the page's per-frame audio update, and
  resumes. Every fetch and decode is awaited at the tick it starts. The render is
  sample-accurate to the picture and doesn't depend on machine speed.
  `performance.now()` is a virtual clock and `Math.random` is seeded, so a scene renders
  the same way every time.
- **Picture.** `scripts/capture-clip.cjs --scene N` steps the same war the same way and
  renders each tick. Both passes end at the same battle time with the same ships alive
  (checked on every scene), so picture and sound line up.
- **Measurements.** `scripts/audio-report.py --scene` measures each capture;
  `scripts/audio-scene-plot.py` draws it and `scripts/audio-scenes-table.py` tabulates it.
  - Integrated loudness is ITU-R BS.1770-4 (K-weighting, 400 ms blocks, both gates). It
    matches ffmpeg's `ebur128` exactly on the baseline war (-13.3 LUFS, -0.1 dBTP).
  - True peak is measured 4x oversampled.
  - Captures are 32-bit float WAVs, so an over is counted, not hidden by conversion.
- **Other measurements.**
  - Level and pan: level every 50 ms. Pan is the inter-channel level difference, as
    (R²−L²)/(R²+L²).
  - Pitch shift at closest approach: the log-frequency spectra either side of it are
    cross-correlated, in 1/24-octave steps.
  - Active voices come from the engine's own stats, per tick.

WAVs are not committed (about 70 MB per build). AAC encodes are, for the listening page.

## Pass criteria (stated before any change)

1. **Fly-by (scenes 1 and 5):**
   - The level at closest approach is at least 12 dB above the level 1.8 to 3.2 s
     before, and at least 12 dB above the level 1.8 to 3.2 s after.
   - No 50 ms step larger than 6 dB (a smooth rise and fall, not a pop).
   - The pan position moves by at least 0.5 across the pass.
   - The pitch shift across closest approach is negative (a drop).
2. **Nothing clips:**
   - 0 samples at or over full scale.
   - True peak ≤ -1.0 dBTP in every scene.
3. **Loudness:** the 90-second war (scene 10) measures -16 LUFS integrated, ±1.5 LU.
4. **Close scenes have a real low end but are not mud:** under 45% of energy below 120 Hz.
5. **Audio never costs frames:**
   - The per-frame audio JS on the main thread is under 1 ms on average.
   - The audio render thread stays under 25% of real time in the heaviest scene.


The criteria above are the ones I wrote before any change. Nothing below moves them. Where
I measured something extra afterwards (the solo passes, the fight-to-pan correlation, the
death peaks and dips), it's labelled as added later.

## Results against the criteria

| # | Criterion | Result | Verdict |
|---|---|---|---|
| 1 | Fly-by, whole mix: rise and fall ≥ 12 dB, no step > 6 dB, pan moves ≥ 0.5, pitch drops | Scene 1: rise 14.4, **fall 6.4**, step 1.1, pan -0.17 → 0.53, pitch -6.5 st. Scene 5: rise 14.2, **fall 0.2**, step 1.1, **pan 0.03 → -0.24**, pitch -1.0 st | **Fail** (scene 1 on fall; scene 5 on fall and pan) |
| 1 | Same pass, subject alone (added later) | Scene 1: rise 66.4, fall 42.2, step 2.7, pan -0.28 → 0.76, pitch -4.5 st. Scene 5: rise 30.0, **fall 9.2**, step 1.4, pan flat (it passes overhead), pitch -3.0 st | Scene 1 passes; scene 5 fails on fall and pan |
| 2 | Nothing clips: 0 overs, true peak ≤ -1.0 dBTP | 0 clipped samples in all ten scenes; loudest true peak -1.15 dBTP (scene 3) | **Pass** (before: 20 and 24 overs, +0.03 dBTP) |
| 3 | 90-second war at -16 LUFS ±1.5 | -16.2 LUFS | **Pass** (before: -13.3) |
| 4 | Close scenes under 45% of energy below 120 Hz | 13-16% in scenes 1, 3, 4, 5, 7; 25% in 9; 42% in 6; **57% in scene 2** | **Fail** on scene 2 (the destroyer overhead) |
| 5 | Audio JS < 1 ms per frame; render thread < 25% of real time in the heaviest scene | JS 0.30-0.69 ms per frame (captures), 0.21 ms (real-time page); render 24.8% at worst offline (scene 3), 7.4% real-time | **Pass**, the render share only just |

Why the fails fail:

- **Scene 1's fall (6.4 dB, needs 12).** The subject passes and goes, and the solo capture
  shows it fall 42 dB. But the fall window (1.8 to 3.2 s after) isn't empty: the plot
  shows guns starting at 2.6 s and again at 6.3 s, and other fighters' engines stay voiced
  (up to 8 at once). The window measures them, not the pass. I didn't want to silence the
  war to pass a meter.
- **Scene 5 (fall and pan).** This is a squadron flying *over* the camera. The ships go
  from ahead and above to behind, so left/right pan hardly moves by design: the engine log
  shows the members' directions spanning front/back -0.99 to 0.63 and up to 1.0, which a
  stereo ILD can't show. Even alone, the subject's fall is 9.2 dB.
- **Scene 2 (57% under 120 Hz).** It's a 1.6-km destroyer passing 227 units overhead, and a
  wall of rumble is what the brief asks for there. It's still over the 45% I set. It
  dropped from 74% before.

## Final numbers

Before is `main`'s audio (captured from a worktree at 7ee01f9, which adds only the scene
tools to a3adc58). After is this branch. Scenes 1, 2 and 9 were re-picked during the work
(DECISIONS.md) and their baselines re-captured, so the before and after rows are the same
war, seed, time and camera.

| # | Scene | Build | LUFS (I) | True peak dBTP | Clipped | Level p10/p90 dB | <120 Hz | 120-500 | 500-2k | 2-8k | Voices mean/max |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Fighter pass, parked camera | before | -14.0 | -1.25 | 0 | -34.4 / -15.9 | 7% | 9% | 72% | 11% | 1.5 / 4 |
| 1 | Fighter pass, parked camera | after | -24.1 | -9.96 | 0 | -40.1 / -24.2 | 14% | 67% | 17% | 2% | 8.4 / 11 |
| 2 | Capital overhead | before | -15.4 | -2.49 | 0 | -31.5 / -16.4 | 74% | 23% | 3% | 1% | 1.6 / 4 |
| 2 | Capital overhead | after | -19.6 | -2.06 | 0 | -27.1 / -19.6 | 57% | 42% | 2% | 0% | 4.8 / 12 |
| 3 | Riding along in a dogfight | before | -13.1 | -1.74 | 0 | -24.7 / -14.0 | 27% | 24% | 31% | 18% | 6.9 / 10 |
| 3 | Riding along in a dogfight | after | -15.1 | -1.15 | 0 | -22.5 / -17.1 | 14% | 51% | 24% | 8% | 26.2 / 33 |
| 4 | Beside a capital firing a broadside | before | -6.6 | 0.03 | 20 | -13.1 / -10.1 | 6% | 6% | 50% | 35% | 7.9 / 12 |
| 4 | Beside a capital firing a broadside | after | -11.9 | -1.34 | 0 | -28.8 / -13.3 | 15% | 46% | 16% | 15% | 31.3 / 35 |
| 5 | Squadron overhead | before | -10.4 | -1.48 | 0 | -45.3 / -12.2 | 15% | 23% | 42% | 20% | 4.3 / 8 |
| 5 | Squadron overhead | after | -12.2 | -1.49 | 0 | -30.9 / -13.2 | 13% | 32% | 43% | 11% | 20.5 / 28 |
| 6 | Capital death at close range | before | -10.8 | 0.03 | 24 | -29.6 / -9.4 | 34% | 20% | 32% | 12% | 3.8 / 9 |
| 6 | Capital death at close range | after | -16.7 | -1.46 | 0 | -30.8 / -14.8 | 42% | 26% | 15% | 17% | 12.2 / 28 |
| 7 | Ion strike near the camera | before | -11.4 | -0.29 | 0 | -22.1 / -12.1 | 31% | 23% | 28% | 16% | 7.4 / 10 |
| 7 | Ion strike near the camera | after | -18.6 | -1.45 | 0 | -30.5 / -19.4 | 16% | 34% | 36% | 14% | 26.7 / 35 |
| 8 | Wide Broadcast pull-back | before | -14.7 | -2.47 | 0 | -25.6 / -14.8 | 71% | 25% | 3% | 1% | 2.3 / 7 |
| 8 | Wide Broadcast pull-back | after | -20.5 | -3.31 | 0 | -33.4 / -21.5 | 68% | 21% | 5% | 6% | 8.6 / 22 |
| 9 | Cockpit, Take control | before | -10.9 | -1.02 | 0 | -18.7 / -12.9 | 31% | 21% | 36% | 12% | 5.9 / 9 |
| 9 | Cockpit, Take control | after | -15.1 | -3.38 | 0 | -24.6 / -15.5 | 25% | 18% | 34% | 22% | 19.4 / 28 |
| 10 | A 90-second war in Broadcast | before | -13.3 | -0.06 | 0 | -25.1 / -13.4 | 31% | 24% | 29% | 16% | 3.5 / 11 |
| 10 | A 90-second war in Broadcast | after | -16.2 | -1.31 | 0 | -33.2 / -15.5 | 35% | 45% | 12% | 7% | 14.2 / 38 |

"Voices" counts every sounding voice: the one-shot pool plus the engine, weapon and impact
emitters.

Fly-bys (closest approach of the scene's subject, from the log):

| # | Build | Closest (u) at s | Rise dB | Fall dB | Max step dB/50 ms | Pan before > at > after | Pitch shift (st) | Pass |
|---|---|---|---|---|---|---|---|---|
| 1 | before | 31 at 3.4 | 24.0 | 10.0 | 2.0 | 0.01 > 0.19 > 0.05 | 0.0 | FAIL (fall, pitch, pan) |
| 1 | after | 31 at 3.4 | 14.4 | 6.4 | 1.1 | -0.17 > -0.34 > 0.53 | -6.5 | FAIL (fall) |
| 1 | solo | 31 at 3.4 | 66.4 | 42.2 | 2.7 | -0.28 > -0.47 > 0.76 | -4.5 | pass |
| 2 | before | 227 at 5.7 | 9.4 | 0.1 | 1.7 | 0.01 > 0.08 > -0.23 | 0.0 | FAIL (rise, fall, pitch, pan) |
| 2 | after | 227 at 5.7 | 2.6 | -1.6 | 0.6 | 0.02 > 0.01 > 0.16 | 0.0 | FAIL (rise, fall, pitch, pan) |
| 2 | solo | 227 at 5.7 | 0.9 | 0.1 | 0.9 | -0.03 > -0.04 > -0.07 | 0.0 | FAIL |
| 5 | before | 46 at 4.967 | 15.8 | -1.9 | 5.7 | -0.19 > 0.06 > -0.04 | 0.5 | FAIL (fall, pitch, pan) |
| 5 | after | 46 at 4.967 | 14.2 | 0.2 | 1.1 | 0.03 > 0.29 > -0.24 | -1.0 | FAIL (fall, pan) |
| 5 | solo | 46 at 4.967 | 30.0 | 9.2 | 1.4 | 0.11 > 0.18 > 0.07 | -3.0 | FAIL (fall, pan) |

What the rows say:

- **The before build had no pass.** Scene 1 before rises and falls because guns start and
  stop, but the pitch doesn't move and the pan ends where it started. After, the pitch
  drops 6.5 semitones through closest approach and the pan swings from left to right.
- **The solo pass is the real thing.** It rises 66 dB out of silence and falls 42 dB. It
  swings from -0.28 to +0.76, and the interaural delay is -0.71 ms on the way in (the
  HRTF placing it on the left). It drops 4.5 semitones as measured in the audio, against
  the 5.6 the engine applied (Doppler 1.196 in, 0.867 out).
- **Scene 2's destroyer does move on, but the scene is too short to hear it leave.** Solo,
  its level is flat across 14 s, because the camera flies along under a 1.6-km hull at
  about 100 units/s and the hull's nearest point stays about 250 units away. The nozzles
  do move on:
  - their direction goes from ahead and above (0.86 up, 0.51 ahead) through overhead
    (0.99 up) to behind (-0.99);
  - their Doppler goes from 1.117 to 0.910, a 3.5-semitone drop;
  - their level peaks as they pass and is 5 dB down by the end.

  A stereo meter can't see front and back, and the scene ends while the camera is still
  under the hull. A longer scene is on the next-steps list.

## Eyes closed: can you tell where the fight is, what just flew past, and when something big died?

**Mostly yes, and here's the evidence, including where it's weak.**

**Where the fight is (left and right: yes; front, back and height: only in the engine's
own log).** I added this measure later. For every tick with guns sounding, I took the
gain-weighted left/right of the sounding guns and hits from the engine, and correlated it
with the pan measured in the rendered audio:

| Scene | Ticks | Correlation |
|---|---|---|
| 4, beside a broadside | 300 | 0.84 |
| 3, dogfight ride-along | 357 | 0.72 |
| 9, cockpit | 359 | 0.61 |
| 10, 90-second war | 1817 | 0.51 |
| 7, ion strike | 330 | 0.50 |
| 5, squadron overhead | 209 | 0.39 |
| 6, capital death | 480 | 0.27 |
| 2, capital overhead | 64 | 0.24 |
| 8, wide pull-back | 206 | 0.24 |
| 1, fighter pass | 103 | 0.06 |

In the busy close scenes, the side the audio leans to is the side the fire is on. It's
weak where fire is sparse or dead ahead:
- In scene 1, at most four guns sound at once.
- In scene 8 the camera is wide and the fight is a distant bed by design.
- Scene 6 is mostly a capital's blast and its tail, which sit in the middle.

Front, back and height are carried by the HRTF on the nearest six voices (on High). An
ILD meter can't measure that, so the only evidence is the engine's direction log (above).

**What just flew past (yes, for a pass within a few ship lengths):**
- Scene 1 whole mix: the pitch drops 6.5 semitones through the pass, the pan swings 0.70
  from left to right, and the level rises 14.4 dB with no step over 1.1 dB per 50 ms.
- Alone, the same fighter rises 66 dB and falls 42 dB.
- It sounds like its own fleet: its engine loop is its fleet's fighter class, with its
  own Doppler.
- A squadron is heard as a squadron: in scene 5, 8 of the 10 members' engines were voiced
  around the pass, each with its own Doppler (0.918 to 1.105) and its own direction.
- Bolts that pass close whizz: 15 whizz-bys in the dogfight, 21 beside the broadside, 9 in
  the 90-second war.

The weak case is a slow capital: scene 2 is a steady wall, not a pass.

**When something big died (yes).** I added this measure later: for each capital or hero
death in a scene, the loudest 400 ms in the 2.5 s after it against the scene's median,
and the quietest 400 ms after that against the 2 s before the death.

| Scene | Death | Distance (u) | Peak over median | Dip below the war before |
|---|---|---|---|---|
| 6 | Imperial destroyer (Vanquisher) | 861 | +12.7 dB | 4.6 dB |
| 10 | Imperial destroyer (Vanquisher) | 1178 | +11.1 dB | 4.8 dB |
| 10 | Rebel hero freighter | 1369 | +6.1 dB | 3.8 dB |
| 4 | Federation cruiser (Excelsior) | 798 | +3.4 dB | 11.9 dB |

- **The capital death is the loudest thing in its scene.** In scene 6 the master meter
  goes from about -29 dB to -14 dB at the blast. 42% of the scene's energy sits below
  120 Hz, and the low thump layer is a recording, not a synthesized tone.
- **Then the war falls away under a ringing tone.**
  - Within 0.3 s of the blast's end, the master falls from -14 to -32 dB.
  - The score falls from -36 to -56 dB, and guns and engines by 26 dB.
  - The ringing tone (the high steady line in `after/06.png`) runs for about 5 s, and the war
    comes back over 2.5 s.
- **The dip is deep against the blast (18 dB) but shallow against the war before it
  (4.6 dB)**, because this war was quiet just before the kill. What fills it is the far
  hall's tail and the ringing, both on purpose. In scene 4, where the kill interrupts a
  broadside, the dip is 11.9 dB under the war.
- The Excelsior's peak is only +3.4 dB because it dies 0.6 s into a scene whose median is
  a broadside.

**Honest limits:**
- Front and back are only as good as the listener's headphones and Chrome's HRTF.
- On speakers, or with the 3D sound switch on Speakers, it's left/right only.
- A slow capital pass doesn't leave inside 14 s.

## What the war is doing: voices and budgets

The budgets are the peak simultaneous voices per group across all ten after scenes, read
from the engine every tick:

| Group | High budget | Peak used | Low budget |
|---|---|---|---|
| Engines (capital rumble ceiling) | 8 (3) | 8 | 4 (1) |
| Weapons | 16 | 16 | 8 |
| Impacts | 12 | 12 | 6 |
| HRTF voices | 6 | 6 | 2 |

The HRTF row held only after a fix. The first final run peaked at 11 HRTF voices, because
held one-shots never gave their slot back. DECISIONS.md has the details, and a test now
reproduces it.

Activity from the engine's counters:

| Scene | Voices started | Handoffs | Model swaps | Culled | Dropped | Whizz | Hits (shields) | Beams | Arrivals | Dips |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 45 | 9 | 18 | 5 | 0 | 0 | 0 | 0 | 0 | 0 |
| 2 | 31 | 5 | 0 | 34 | 3 | 0 | 7 | 0 | 0 | 0 |
| 3 | 341 | 105 | 38 | 27 | 0 | 15 | 26 | 0 | 0 | 0 |
| 4 | 437 | 114 | 47 | 8 | 22 | 21 | 192 (152) | 112 | 0 | 1 |
| 5 | 158 | 40 | 18 | 6 | 23 | 0 | 5 | 0 | 8 | 0 |
| 6 | 135 | 3 | 8 | 170 | 0 | 0 | 55 | 0 | 0 | 1 |
| 7 | 267 | 24 | 52 | 15 | 2 | 1 | 37 | 0 | 0 | 0 |
| 8 | 89 | 41 | 5 | 42 | 0 | 0 | 10 | 0 | 0 | 0 |
| 9 | 239 | 53 | 39 | 30 | 0 | 1 | 12 | 0 | 0 | 0 |
| 10 | 879 | 128 | 83 | 570 | 44 | 9 | 215 | 0 | 14 | 1 |

- **Dropped** means one-shots refused by the priority pool when it was full.
- **Culled** means sounds beyond their hearing radius.
- **Handoffs** are voices that changed hands with a 150-300 ms crossfade.
- **The cockpit** (scene 9) held for all 360 ticks. The listener blend reached 0.50 in
  the wide pull-back (scene 8), meaning the ear sat halfway from the camera to the
  subject.
- **The end states match.** Every after, before, solo and video capture ends at the same
  battle time with the same ships alive. That's the check that audio doesn't touch the
  simulation, alongside the determinism tests.

## Cost

| Measure | Before | After |
|---|---|---|
| Audio JS on the main thread, per frame (offline captures) | 0.06-0.12 ms | 0.30-0.69 ms |
| Audio JS per frame, real page (`scripts/audio-perf.cjs`, Broadcast, 30 s) | | 0.21 ms |
| Audio render thread, offline capture (CPU time / audio time) | 5.5-6.7% | 15-25% |
| Audio render thread, real time (`audio-perf.cjs`) | 5-7% | 7.4% |

- The offline share includes suspending and resuming the render every 1/30 s, so it
  overstates the real-time cost.
- Frame times couldn't be measured meaningfully here: software GL runs the page at 3 to
  4 fps, with or without audio.
- The biggest single saving was not automating the panners and the listener. That took
  the render thread from 80% to 34% in scene 1 (DECISIONS.md).

## Downloads

| What | When | Size |
|---|---|---|
| Core set (bed, score calm stem, shared hits, explosions, whooshes) | first gesture | 3.01 MB |
| The war's fleets (guns, beams, engines, deaths, shields, arrivals) | first gesture | 0.90-1.77 MB each; worst two 3.13 MB |
| Tension stem, capital-death layers, ion strike, stinger | right after | 2.51 MB |
| **First gesture total, worst two-fleet war** | | **8.66 MB** (budget 10) |
| Battle stem, codas, cockpit beds | intensity over 0.3, or 20 s in | 2.75 MB |
| Everything else | on first use | |
| Whole set, 645 files | | 32.96 MB |

The captures measured 7.59 MB loaded by the end of the quiet scenes (Empire vs Rebels) and
10.35 MB once the battle stem and codas had streamed. A war with allies adds up to two
more fleets.

## Spend

The ledger is `bench/audio/ledger.csv`: every generation with its model, role, take,
seconds, cost, running total and prompt.

| Model | Generations | Seconds | Cost |
|---|---|---|---|
| ElevenLabs Sound Effects v2 (fal.ai) | 319 | 1558.6 | $3.1172 |
| ElevenLabs Music (fal.ai) | 2 | 232.5 | $2.4000 |
| **Total** | **321** | | **$5.5172** of the $10 cap (stop at $9.50) |

Two generations ($0.0032) are paid for but not used: Tesla gun takes whose prompt named a
brand-named device. They're marked in the ledger and in `roles.json`.

## Log: what worked and what didn't

In order, with the evidence that decided each step.

1. **Scenes and baseline first.** Scene 1's first pick measured a hero's explosion three
   seconds before the pass rather than the pass, so I re-picked it. Scene 2 was extended
   so the destroyer's stern could clear, which wasn't enough (above). Scene 9's pilot died
   5.3 s in, so it now pilots the freighter.
2. **Emitters and virtual voices.** They worked on the first build, but the render thread
   ran at 80% of real time. Automating panner and listener parameters every frame put
   Chrome on its per-sample path. Writing plain values, keeping the listener fixed and
   moving a panner only when its direction turns more than 1.5° brought it to 34%, and
   the rest of the work settled it at 15-25%.
3. **Capital rumble starved the fighters.** A sky of destroyers held every engine voice.
   The fix was a rumble ceiling inside the engine budget, a radius cap for giant hulls and
   predictive ranking.
4. **The old distance curve made a wall.** Everything was at full level to a tenth of the
   radius, so I replaced it with an inverse law from a reference distance set by size.
5. **HRTF lagged fast passes by about 100 ms.** Anything sweeping faster than about
   140°/s now uses equal-power.
6. **The fly-by whoosh masked its own engine and Doppler.** It now moves with the ship,
   skips Doppler and sits lower.
7. **The mix measured dark** (40% of energy under 120 Hz, 330 Hz centroid). Muting each bus
   in turn found fighter and frigate engines, not capital rumble. I rebalanced to
   -16.0 LUFS with a 495 Hz centroid.
8. **The stinger filled the post-death silence,** so it no longer plays over a dip.
9. **Rejected takes, by measurement.** Thirty-one takes are out:
   - Twelve carried a falling low tone: an Imperial gun, two Borg guns, a bed, a whoosh,
     three engines, a capital break-up, ion fire, an Imperial beam and a warp breach.
     Some of these came from the earlier pass.
   - Fifteen were sub-heavy engine or shield takes (51-97% of their energy under 120 Hz).
   - Two were mostly silent.
   - The two Tesla gun takes were left out for their prompt.

   The last check found that both of the Tesla fleet's fighter engine takes had been
   rejected, so its fighters were borrowing the frigate loop. Two new takes with a brighter
   prompt ($0.032) both passed, so every role now has at least one clean take.

   `audio/build-report.json` has each take and its reason, and `audio/board.html` lists
   them.
10. **Fourteen loops stepped at the wrap.** A measured fold choice (end or best-match, with
    a 0.4-1.2 s crossfade) fixed all of them. The test checks 174 decoded loops.
11. **In the final pass**, the evidence turned up four more problems. Each is fixed, and a
    test reproduces each one:
    - HRTF came out 3 dB louder than equal-power, so hand-overs jumped. HRTF voices are now
      trimmed, with +1.6 dB of master makeup.
    - The first-gesture download was 11.3 MB. The battle stem, codas and cockpit beds now
      load later.
    - The post-death dip never reached the score. The page's per-frame slow-motion call
      cancelled every duck on it, and staged secondaries cut the dip short.
    - The HRTF budget leaked to 11 voices.
12. **What I didn't fix:** scene 1's whole-mix fall, scene 5's fall and pan, scene 2's
    energy below 120 Hz and its too-short pass. The reasons are above.

## Listening

`audio/scenes.html` plays each scene's video, muted, over three synced audio tracks:
before, after and, where there is one, the subject alone. Switching between them is
instant (B, A, S) and the plots sit underneath. It reads `bench/audio/scenes/`, so it
works on GitHub Pages. `audio/board.html` plays every recording by role.
