# Director-package to technical-storyboard handoff contract

## 1. Responsibility boundary

The directing layer answers:

- When the audience learns each piece of information.
- How characters change their relationship through position and action.
- Why this shot size, angle, focal length, and movement are used.
- When to cut, whom to cut to, and what a reaction is worth.

The technical-storyboard layer answers:

- How a directing shot is allocated into generation jobs the model permits, each 4–15 seconds long.
- Which character, set, prop, voice, and movement references to use.
- How to organize keyframes, prompts, batches, files, and API parameters.

A technical storyboard must not use "the model can make one more cheap cut" as a reason to redesign the viewing logic.

## 2. Field mapping

| Director package | Technical storyboard | Rule |
|---|---|---|
| `sceneId` | `sceneId` / `sceneIndex` | Must trace back to the same script scene |
| `clipId` | generation segment ID | May be split because of model limits; do not merge across scenes without a record |
| `shotId` | storyboard / cut ID | Preserve the original ID or record `sourceShotId` |
| `beatRefs` | claimed script beats | Coverage relationships must not change |
| `dramaticPurpose` | shot intent | Preserve verbatim for deviation auditing |
| `size` / `angle` / `lensMm` | shot size, camera position, composition prompt | Do not replace narrative purpose with model vocabulary |
| `camera` | H3 movement description | Preserve trigger, path, speed, and endpoint |
| `blocking` | subject action and placement | Technical simplification must not change the power outcome |
| `axisAction` / `screenDirection` | continuity fields | Must survive segment splitting |
| `dialogueRefs` | `<d>` or voice item | Determined by the segment's voice route |
| `coverageRefs` | `coverageOf` | Supplemental-information/reaction shots must not claim the same primary beat twice |
| `poseContinuity` | `pose` / reference-image QC | Lying, sitting, standing, support points, and the hand holding an object must be preserved |
| `informationPlan` | `information` | Carrier, legible elements, display strategy, and minimum frame share must not be lost |

## 3. Valid technical splitting

One directing `clip` may be split into multiple model jobs if:

- It exceeds the model's maximum single-job duration.
- It exceeds reference-image or reference-audio limits.
- Action complexity, multi-person occlusion, or spatial jumps cannot be executed reliably.
- Voice routes differ, such as separating dialogue from voice-over.

After splitting, you must:

- Preserve the source of every directing `shotId`.
- Preserve the original total duration or record approved pacing changes.
- Design composition, action phase, eyelines, and sound handoff at segment starts and ends.
- Avoid claiming the same main beat more than once.

## 4. Deviation record

```json
{
  "deviationId": "DEV-E01-003",
  "sourceShotId": "E01-S01-C02-SH03",
  "fields": ["referenceMode", "camera"],
  "reason": "H3 reference audio is mutually exclusive with first/last-frame mode",
  "original": "Lock first and last frames while using the protagonist's reference voice",
  "change": "Keep the reference voice and switch to Ref2VA; control the end frame in post",
  "dramaticImpact": "The position of the ending evidence may drift and needs keyframe QC",
  "approvedBy": "user",
  "status": "approved"
}
```

Record a deviation when shot size changes, shot order changes, moving camera becomes static or vice versa, the axis is crossed, dialogue becomes voice-over, duration changes by more than 15%, a reference voice becomes a free voice, a reaction shot is removed, or the end image changes.

## 5. Storyboard quality gate

In addition to the existing storyboard validation, check:

1. Every technical shot has a `sourceShotId`.
2. Technical storyboards cover every directing shot.
3. `dramaticPurpose` is not lost.
4. Shot size, angle, movement, and screen direction have no silent deviations.
5. H3 Ref2VA is not mixed with first/last-frame mode.
6. Main speaking characters bind to approved voice masters.
7. Music defaults to post; ambience crossing segments has a continuity plan.
8. Every deviation has a reason, impact, and approval state.
9. Plot-critical on-screen/file information has an independent insert, full-screen content, or post composite; it does not exist only on a small environmental screen.
10. Candidate reference images pass pose, support-point, hand-assignment, and information-legibility acceptance before entering the final H3 reference list.
11. Remove composition candidates with extra hands, wrong hand assignment, pose, support-point, or axis errors from the reference list. Use semantic assets for people, sets, props, and content, then restage through prompts; do not textually force-correct a bad image.

## 6. Included bridge

The production-control layer creates its formal adaptation layer with `scripts/storyboard-bridge.mjs`:

```bash
node scripts/storyboard-bridge.mjs build <director-package.json> \
  --script <script.json> --out <storyboard.json> --aspect 16:9
node scripts/storyboard-bridge.mjs validate <storyboard.json> \
  --director <director-package.json> --script <script.json> --aspect 16:9
```

It deterministically performs:

- `clip` → H3 `segment`, and `shot` → technical `cut`.
- Director `beatId` → contiguous script `flow` range.
- Technical mapping from shot size to H3 camera-movement enums.
- Transfer of reference media, voice bindings, H3 prompts, and per-segment `prompt.md` files.
- Preservation of `sourceShotId`, a directorial-intent snapshot, and 16:9 composition configuration.
- Validation of directing-shot coverage, duplicates, omissions, and silent deviations.

The bridge result is a technical-storyboard draft, not automatic aesthetic completion. It preserves warnings for non-English or overly thin `framePrompt` values, directing shots longer than the usual 2–5 seconds, and complex character lists. The technical storyboard artist remains bound by directorial intent and deviation approval when resolving them.
