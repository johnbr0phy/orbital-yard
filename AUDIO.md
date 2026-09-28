# Tribute War audio: measurements

This file is the evidence for the sound of `armada-war-tribute-new.html`. Every number
here was measured from the page's real audio output, rendered by headless Chromium.
Nothing in it is estimated by ear, because I can't listen in this environment.
The owner judges by ear in `audio/scenes.html`.

## How scenes are captured

- **The scene set.** `bench/audio/scenes.json` holds ten scenes: a seeded war, a start
  time and a scripted camera. Cameras are computed from probed trajectories
  (`scripts/audio-probe.cjs`, then `scripts/audio-pick-scenes.py`), so the TIE really
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

## Baseline (today's build, before any change)

Captured from `main` at a3adc58 with the scene set above.
Plots: `bench/audio/scenes/before/NN.png` (spectrogram, level, pan, voices).

| # | Scene | Build | LUFS (I) | True peak dBTP | Clipped | Level p10/p90 dB | <120 Hz | 120-500 | 500-2k | 2-8k | Voices mean/max |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Fighter pass, parked camera | before | -9.6 | -0.15 | 0 | -18.5 / -9.6 | 20% | 24% | 40% | 16% | 7.3 / 11 |
| 2 | Capital overhead | before | -15.8 | -4.09 | 0 | -32.2 / -16.5 | 72% | 24% | 3% | 1% | 1.2 / 2 |
| 3 | Riding along in a dogfight | before | -13.1 | -1.74 | 0 | -24.7 / -14.0 | 27% | 24% | 31% | 18% | 6.9 / 10 |
| 4 | Beside a capital firing a broadside | before | -6.6 | 0.03 | 20 | -13.1 / -10.1 | 6% | 6% | 50% | 35% | 7.9 / 12 |
| 5 | Squadron overhead | before | -10.4 | -1.48 | 0 | -45.3 / -12.2 | 15% | 23% | 42% | 20% | 4.3 / 8 |
| 6 | Capital death at close range | before | -10.8 | 0.03 | 24 | -29.6 / -9.4 | 34% | 20% | 32% | 12% | 3.8 / 9 |
| 7 | Ion strike near the camera | before | -11.4 | -0.29 | 0 | -22.1 / -12.1 | 31% | 23% | 28% | 16% | 7.4 / 10 |
| 8 | Wide Broadcast pull-back | before | -14.7 | -2.47 | 0 | -25.6 / -14.8 | 71% | 25% | 3% | 1% | 2.3 / 7 |
| 9 | Cockpit, Take control | before | -11.5 | -0.44 | 0 | -22.0 / -11.9 | 25% | 25% | 35% | 14% | 7.5 / 10 |
| 10 | A 90-second war in Broadcast | before | -13.3 | -0.06 | 0 | -25.1 / -13.4 | 31% | 24% | 29% | 16% | 3.5 / 11 |

Fly-bys (subject closest approach from the log; rise/fall = level at closest approach minus the 1.4 s window 1.8-3.2 s before/after; pitch = cross-correlated log spectra 0.5 s either side):

| # | Build | Closest (u) at s | Rise dB | Fall dB | Max step dB/50 ms | Pan before > at > after | Pitch shift (semitones) | Pass |
|---|---|---|---|---|---|---|---|---|
| 1 | before | 31 at 3.4 | -2.2 | 1.2 | 1.7 | -0.17 > -0.4 > 0.75 | 0.0 | FAIL (rise, fall, pitch) |
| 5 | before | 46 at 4.967 | 15.8 | -1.9 | 5.7 | -0.02 > -0.0 > -0.02 | 0.0 | FAIL (fall, pitch, pan) |


What the baseline shows:

- **The close TIE pass (scene 1) doesn't exist in the sound.** The level at closest
  approach is 2.2 dB *below* the level before it. The pitch doesn't move.
  - The fly-by predictor never fired: a TIE crossing at 142 units/s, 31 units away,
    got no pass-by.
  - The pan swing (-0.17 to 0.75) comes from other guns, not from the TIE.
- **The squadron (scene 5) arrives but never leaves.**
  - Level rises 15.8 dB as the guns start, then stays up (fall -1.9 dB).
  - The pan sits in the middle (−0.02 throughout).
  - There's no pitch shift.
- **The capital overhead (scene 2) is only the score and the bed.**
  - At most 2 voices, 72% of the energy below 120 Hz, -15.8 LUFS.
  - Nothing tells you a 1-km hull is passing over you, because only the followed ship
    has an engine.
- **Close combat is too loud and clips.**
  - The broadside (scene 4) measures -6.6 LUFS with 20 clipped samples and a true peak
    of +0.03 dBTP.
  - The capital death (scene 6) clips 24 samples.
  - The tanh soft clipper is doing the limiting, audibly.
  - The 90-second war sits at -13.3 LUFS, 3 dB hotter than the -16 target.
- **The capital death (scene 6) has no silence after it.** The level stays within about
  10 dB for the 12 s after the kill.
- **Nothing is behind or above you.**
  - Stereo panning only.
  - The pan traces swing from shot to shot, but there's no sustained source.
- **Cost is small:**
  - About 0.06 to 0.1 ms of JS per frame.
  - The audio render thread uses 5 to 7% of real time.
  - Voices peak at 12.

