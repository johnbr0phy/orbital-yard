# Distant hull rendering

The alternate `armada-war-tribute-2.html` renderer retains coarse triangle meshes and batches class members with instanced drawing. Its shared-mesh / single-upload approach now replaces the newer page's diamond point sprites.

The forge produces coarse geometry off the main thread. Distant class sisters share one of three representative hulls, scaled to the vessel's length, with individual position, orientation and colour. Close, hero, selected, damaged and cloaked ships retain individual rendering. New battles release coarse geometry buffers.

Checks: 1,000 synthetic sisters use three instanced triangle draws and one instance upload; real forge supplies coarse meshes; cleanup, controls and existing scaling tests pass. A headless Chromium run loaded 1,142 ships without shader/runtime errors. That software-rendered run remained around 10 FPS during arrivals, so this is not evidence that all large-battle performance problems are solved.
