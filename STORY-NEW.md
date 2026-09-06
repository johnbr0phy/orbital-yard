# Stories from the void — separate prototype

Open `tribute-story-new.html`. The existing battle page is unchanged. A same-origin iframe loads it, and a story-only bridge exposes snapshots, cameras, orders and helm transfers. Only that frame gets the story UI overrides and guarded simulation startup.

The page generates 23 crossover home systems, opposing factions, motives, a cargo and a timed survival or command-target objective. Actual damage, deaths and elapsed simulation time determine outcomes. Orders affect escort destinations or the lead ship’s withdrawal. You can fly any arrived living ship, on either side. Manual selection/flight stops automatic camera changes; Movie returns control to the AI. Four featured characters have stable per-universe identities and species-specific existing crew portraits. Confirmed deaths retire those identities in subsequent chapters.

Home-system jumps load a new encounter and retain the chronicle; leaving unfinished work records withdrawal. Secured routes have a longer window; contested systems muster more ships. Every fresh page generates a new universe. Keep this universe stores its seed, world conditions, lost characters and chronicle locally; Resume starts the saved chapter, not a frame-exact combat save. There is no continuous interstellar flight or planet landing in this prototype.

This version uses procedural combinations and short event-driven dialogue, not an LLM. Device speech starts from the Begin chapter click and can be muted; it uses browser speech synthesis, not ElevenLabs; voice availability and quality depend on the device. No keys or paid generation are used. A real AI/ElevenLabs integration needs a server-held key, authentication, bounded generation, audio caching and cancellation of stale lines. Do not put provider secrets in the public GitHub Pages files. The user’s logged-in ElevenLabs developer page was inspected read-only; no key was created or copied.

The cinematic controller holds shots for sixteen seconds, alternating established subjects and the existing action/overview cameras. This is a live prototype, not a replay editor. Dialogue reacts to injuries, death, progress and orders. Characters have stable identities and recorded survival, but autonomous long-term relationship simulation and generative plots are future work.

Validation: deterministic world generation, valid distinct factions, outcome and consequence rules, cross-side helm transfers, opening pause, retired identities, and existing battle renderer via browser. New files only. No change to the battle page’s default flow or fleet implementations.

Voice playback now reports start/failure, retries the visible line on re-enabling, selects English device voices when available, and detects silent startup failures. An isolated in-app browser test emitted the speech start event after a direct click; automated tests cover mute, cancellation and failure reporting. This verifies the playback interface, not the device’s physical output volume.

## Physical bridge prototype

Nearby ships now receive an actual windowed cabin anchored from broad upward-facing hull triangles (a top-vertex fallback handles irregular organic meshes). This is a procedural cabin attachment, not a hand-authored reconstruction of every canonical bridge. Cabins include floor, roof, window framing, translucent glazing, a seat/plinth and consoles. Organic factions receive a ribbed variant. Crew uses the existing species-specific coloured triangle geometry in the world renderer, with emotion, head movement and speech-driven mouth animation. Mouth motion is procedural, not phoneme-aligned lip sync.

Zooming a followed ship close enough shifts the orbit focus toward its cabin and allows sub-metre approach. Crew opens a cabin camera. Flight now places the camera at that cabin’s helm and hides the player’s own crew mesh; the ship’s physical weapon sockets remain unchanged. Story dialogue names both captain and ship and visits the cabin in Movie mode. A portrait remains available for communications during user-controlled flight/manual framing. Dragging, selecting and taking the helm cancel the director’s camera ownership.

At most three nearby interiors render, with cached geometry uploads at 10 Hz and two draws per room (opaque crew/structure and glazing). Distant interiors, dead ships and cloaked ships are excluded. This is a bounded rendering cost, not a full-density FPS guarantee. New-battle cleanup drops the cached GPU buffers. The main battle page also supports the physical cabins.

Tests cover hull-surface placement, finite bounded crew geometry for all 23 races, real camera/helm ownership, plus existing story, voice, flight, traffic and species checks. Browser inspection confirmed a captain and the real outside scene visible through the cabin windows.
