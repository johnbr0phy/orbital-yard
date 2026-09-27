# Audio report: story pass

Captured with `scripts/capture-audio.cjs --seed 77 --size 50 --seconds 40 --skip 30` (Empire vs Rebels, war seconds 30 to 70, Broadcast camera driving the listener, headless Chromium playing the real Web Audio graph) and measured with `scripts/audio-report.py`. Numbers only: I can't listen in this environment.

| capture | RMS dBFS | peak dBFS | clipped | energy < 120 Hz | 120–500 Hz | 500 Hz–2 kHz | 2–8 kHz (harsh) | > 8 kHz | centroid Hz | onsets/s |
|---|---|---|---|---|---|---|---|---|---|---|
| before (baseline tree) | -22.0 | -4.1 | 0 | 5.0% | 24.5% | 70.0% | 0.6% | 0.0% | 734 | 4.2 |
| story build, first capture | -20.1 | -1.1 | 0 | 1.7% | 12.6% | 63.1% | 21.2% | 1.4% | 1658 | 4.8 |
| story build, final | -20.6 | -0.6 | 0 | 2.5% | 16.0% | 71.7% | 9.1% | 0.6% | 1139 | 4.7 |

## What happened

- **The first story capture was much brighter**: 21% of the energy at 2–8 kHz against 0.6%, centroid 1,658 Hz against 734. The audio module hadn't changed.
- **Cause: where the listener stands.** A logged capture (every voice with its distance to the camera) showed the baseline camera about 22 km from every sound in this window, so everything arrived through the distance lowpass. The story build's cameras ride with subjects 100 m to 2 km away. The harsh seconds lined up with nearby voices.
- **Which voices.** Muting one group at a time: music alone 0.1% harsh; weapons alone 8%; explosions alone 34%. Close explosions had a 700 Hz highpass crack and a noise body open to 4.5 kHz. They had only ever been tuned from far away.
- **Fixes**, both in `armada-audio-new.js`:
  - the near crack is a band around 1.2 kHz and the explosion body stops by 3 kHz;
  - the laser keeps its sweep a third lower (1,150 Hz start instead of 1,700, so its 1.5× partial starts below 2 kHz).
- **Result**: harsh energy 21% → 9.1%, centroid 1,658 → 1,139 Hz, no clipping. `tests/tribute-new/audio.test.cjs` passes, including the rule that no audible tone sits or slides below 150 Hz. Energy below 120 Hz is 2.5%.
- **The before and after aren't the same listening position**, so the fair comparison is the voice split above, not the first two rows.
