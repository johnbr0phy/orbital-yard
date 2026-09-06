# Battle camera, pace and paint

The action camera now opens with a ten-second fleet-wide view that includes ships still arriving. Subsequent shots cut between six-second close chases, wider local engagements, full-fleet views, capital passes and overhead views. Each shot tracks smoothly internally; switching subjects no longer sends the camera on a long flight through empty space. Manual selection and flight retain camera ownership.

Small craft have 25–45% higher cruise speed and a wider sprint range. Healthy attack/flanking/searching craft use their sprint during long approaches. Capital handling and speed are unchanged. These changes do not disable avoidance, targeting or damage.

Hull colours retain fleet palettes with reduced saturation, restrained marking coverage and lower gloss. Each vessel's seed determines subtle colour temperature, brightness, finish and marking placement. Surface details remain in the existing shader pass.

Validation: camera arrival framing, shot variety, moving-subject tracking, manual ownership, deterministic finishes and sprint behaviour; existing watch, pilot, traffic and destroyer checks. Browser rendering is checked separately from headless simulation tests.
