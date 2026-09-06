# Dense-battle performance pass

Profile: deterministic 600-slot Imperial/Tesla muster, all ships active, one second of real simulation in the headless harness. The baseline took ~5.55 seconds CPU, including ~2.11 seconds prediction and ~1.69 seconds contact solving. Profiling wrappers add overhead; these timings are comparative CPU measurements, not browser FPS.

Changes:
- Scalar separating-axis checks reject early instead of allocating fifteen vector arrays for every hull pair.
- Collision bases come directly from the rigid rotation matrix rather than three complete mount transforms.
- Collision broad-phase uses oriented hull world bounds instead of length-sized spheres; swept travel padding and two solver passes remain.
- Prediction checks spread across subsequent frames, with the initial safety check still immediate.
- Dense scenes select instanced 3D hulls earlier, with hysteresis to avoid rapid detail switching. No point sprites.

The first revised run took ~3.06 seconds CPU. Collision, swept hit, weapon, Optimus and scale tests pass. A 1,142-ship software-rendered Chromium check has no shader/runtime errors but still measures ~9 FPS during arrivals. No 60 FPS claim is made; native-browser performance must be assessed separately.
