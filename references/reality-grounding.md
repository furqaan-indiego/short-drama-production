# Reality-subject grounding gate

Use this for projects that are realistic, documentary-like, or explicitly depend on real industry processes. It governs verifiable real-world structure; it does not mistake "realistic" for low saturation, weathered materials, or handheld cinematography.

## When to trigger it

Create `reality-audit.json` before art generation if any of these apply:

- Functional spaces such as transport hubs, hospitals, schools, police or judicial facilities, public-service offices, banks, factories, or commercial kitchens.
- Processes with fixed equipment or sequence, such as security checks, medical visits, administrative work, production, payment, or law enforcement.
- Local life, occupational practice, period objects, or public infrastructure that a model may replace with generic visuals from a neighboring industry.
- The user explicitly requests content that is realistic, factually accurate, follows professional procedure, or reflects local life.

## Five layers of verification

1. **Functional identity:** What exactly does this space do? Do not write only "modern public space."
2. **Required equipment:** Equipment, workstations, and interfaces indispensable to that function.
3. **Spatial topology:** Adjacency, orientation, front/back relationships, and safety distances between equipment.
4. **People and goods flow:** Entry, queueing, operation, exit, and no-counterflow zones; whether people and objects move in the same direction, parallel, or split streams.
5. **Operating state:** Crowd level at a specific time, staff positions, everyday objects, wear, and temporary conditions.

If the spatial process has more than 10% uncertainty, or an error would change image topology, research first. Record at least one authoritative source; add an on-site-image source when visual layout is needed. Record the URL, title, access date, and the concrete invariant derived from the source. Do not substitute style images for factual sources.

## Separate asset images from finished images

- A set-design image may remain **unpopulated** for asset consistency, but must not remove equipment, queue infrastructure, service counters, or entrances/exits necessary to its real function.
- Finished keyframes add people according to real operating state. Density, jobs, orientation, and queueing must come from `peoplePolicy`; do not inherit the asset image's "unpopulated" state.
- "No people in an establishing shot" is only a people-layer rule. It does not mean the space is idle, empty of supplies, or unequipped.

## Minimum prompt contract

Art and storyboard prompts for reality-sensitive scenes must state:

- The exact place name and function. Do not rely on broad terms such as `terminal`, `office`, or `hall` alone to establish identity.
- Functional equipment from `mustHave`.
- Relative positions and one-way relationships from `topology` and `flow`.
- `confusionsToAvoid`, explicitly excluding the most easily confused neighboring locations.
- The people policy for asset images and the crowd policy for finished shots.

## Image acceptance

Return the image for rework if any condition is true:

- Without the prompt, it resembles another industry or another type of place more strongly.
- A `mustHave` item is missing, or equipment is present but cannot perform the stated process.
- Entrance, operation point, and exit block one another; equipment is crossed through, queues intersect, or no exit exists.
- Everyday objects, staff, or real-world traffic are entirely erased to create "cinematic negative space."
- The same person, luggage, or workstation supplies are copied to make the image look busy.

After every generation, update `audit.assetPrompt`, `audit.storyboard`, and `audit.frames`. A reality-sensitive scene that has not reached `pass` must not enter paid video generation.

## Validation

```bash
node scripts/reality-audit.mjs validate <project>/reality-audit.json
```

The validator guarantees only that audit fields and sources are present. A human must still compare keyframes to determine whether the image truly follows real-world process.
