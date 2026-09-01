# Short-drama production pipeline and approval gates

## 1. Overall stages

| Stage | Primary skill | Hard inputs | Core decision | Main output | Human approval gate |
|---|---|---|---|---|---|
| ingest | production control | source material / brief | platform, episode count, episode length, aspect ratio, adaptation scope, generation model; new projects default to 16:9 | `production.json` | project-scope confirmation |
| outline | `novel-outline` | source material / brief | removed plotlines, merged characters, payoff beats, paid points, hooks, suspense | `outline.json` | adaptation direction locked |
| cast | `novel-characters` | source material + locked outline | profiles, visual identity, and voice masters only for retained characters | `cast.json`, character images, voice assets | character and visual style locked |
| art | `novel-art` | outline + characters | set anchors, lighting, narrative props, reference images | `art.json`, set/prop images | visual bible locked |
| script | `novel-script` | outline + characters + art | scenes, action, dialogue, hook fulfillment, duration | `script.json` | each script batch locked |
| director | `short-drama-director` | locked script + visual bible | objective/obstacle/turn, blocking, axis, shot size, focal length, camera movement, cut points | `director-package.json` | directing plan locked |
| storyboard | `storyboard-bridge` **or** `novel-storyboard`; prompts use official `h3-prompt-writing` | script + director package + assets | choose one technical-storyboard ingestion route, adapt duration, bind references; never chain both routes and cut the work twice | `storyboard.json` or H3 production package | technical storyboard locked |
| generate | `h3-official` or CompShare H3 client | locked storyboard + reference assets + voice assets + explicit provider | API-specific preflight, pilot submission, polling, download, hashes, cost | video segments | batch only after pilot approval |
| post | `post-kit` + human post | video segments + post sound + subtitles | 16:9 rough-cut assembly, audio-video sync, sound effects, music, subtitles, grading | working cut | working-cut approval |
| qc | production control + human director | working cut + all upstream work | continuity, narrative, sound, technical, compliance | QC list, rework list, master | final-delivery approval |

## 2. Recommended production order

### Development

Create the complete-drama outline first and budget assets only at a shallow level. At outline approval, confirm removed subplots, merged characters, principal locations, the position of the major payoff, and the ending direction.

### Preproduction

After the outline is locked, create retained characters and primary locations in parallel. Do not mass-produce character images before character retention is decided, and do not create cross-episode assets for one-off dressing.

For realism-based projects, add the grounding gate before scene art: create `reality-audit.json` for functional public spaces and occupational processes, verifying at least functional identity, required equipment, topology, people/goods flow, and operating state. Run `scripts/reality-audit.mjs validate` first. Do not enter paid generation if the audit structure fails or keyframes are still manually marked `fail`.

Build a base art bible from the outline first. After the first script batch is written, lock art once more based on actual prop state, lighting, and blocking. An art update staling the validation state of scripts that depend on it is normal iteration and must not be bypassed.

### Script phase

Default to batches of 1–3 episodes. The first batch is both a script pilot and the trial scope for subsequent directing, storyboarding, and generation. Do not complete all storyboards in bulk before the first batch passes as finished video.

### Directing phase

Break down scenes and block them before fixing camera positions. The director package answers "why look at it this way?" The technical storyboard answers only "how can the target model execute it?" The two layers must not independently recut the same script at the same time.

When entering technical storyboarding, choose one route only: the director bridge turns `director-package.json` directly into a traceable task draft; `novel-storyboard export` is for a standard technical-storyboard package already completed in its own schema. Their outputs connect to `jobs-sync` and `jobs-sync-package` respectively; they are alternatives, not sequential steps.

### Production phase

Use this fixed order:

1. Lock the first directing segment's shots, cut points, pose continuity, and key-information display strategy.
2. Write storyboard-image prompts and generate first-segment candidate references. Do not freeze the final H3 prompt yet.
3. Review character identity, global set orientation, props, lying/sitting/standing pose, support points, the hand holding objects, and key-information legibility. Failed assets must not enter Ref2VA.
4. Based on the ordered, accepted real reference files, use official `h3-prompt-writing` to create the final prompt and preflight the mode.
5. Create the first H3 pilot and review character appearance, voice, action, camera movement, and information legibility.
   - Accept in-frame movement and camera movement separately. At least one of subject, prop, or environment needs clear primary movement with an initiation, development, and cuttable landing.
   - To compare Context-IR, reference sets, language, or duration, create an independent experimental job and record the single changed variable. If multiple changes occur, compare only the whole alternative; do not draw a single-cause conclusion.
   - Before locking simple silent segments, simulate one rhythm compression while protecting minimum information dwell and turning-point reaction. Do not use global final-video speed instead of retiming.
6. Add functional-equipment, spatial-topology, and human-flow review for reality-sensitive scenes.
7. Produce the first scene or episode.
8. Expand to the full batch.

After an API successfully creates a task, do not automatically spend money retrying merely because the result is weak. Attribute rework first: prompt, reference asset, blocking complexity, model randomness, voice reference, or editing issue.

Record the provider explicitly as `minimax-official` or `compshare`. CompShare projects read `compshare-h3.key`; do not look up a MiniMax Official key merely because the target model is also MiniMax-H3. Ingest a production package from `novel-storyboard export` via `jobs-sync-package`; fractional segment duration must first be quantized to a 4–15-second integer while preserving source value and adjustment.

New projects default to `16:9`. The director package, keyframes, H3 jobs, and rough-cut plan must all inherit `production.json.project.format`; changing aspect ratio is an ingest-level change and stales every downstream artifact.

## 3. Approval semantics

An approval locks a concrete file hash and every upstream hash at that time; it is not an abstract statement that a stage is complete forever.

- `review`: the file exists but is unapproved, or the file itself changed after approval.
- `approved`: the file, all dependencies, and the approval snapshot agree.
- `stale`: at least one upstream item changed.
- `missing`: the registered path does not exist.
- `blocked`: a user decision, permission, external service, or unsolvable obstacle is required.
- `skipped`: the user explicitly skipped it and recorded the risk.

Only `approved` artifacts can support paid generation. `stale` and `review` cannot be bypassed with a verbal explanation.

## 4. Rework propagation

Typical propagation:

```text
outline changes a character → cast / art / script / director / storyboard / video / edit all become stale
art changes wardrobe or a prop → script reconciliation, director, storyboard, frames, video, and edit become stale
script changes dialogue → director, storyboard, voice line, video, subtitles, and edit become stale
director changes a shot → storyboard, frames, video, and edit become stale
voice master changes → H3 jobs that reference it and their related video/edit become stale
```

Start rework at the highest real cause; do not hide upstream errors with downstream patches.

## 5. What can and cannot run in parallel

Can run in parallel:

- Characters and base art after the outline is locked.
- Initial script drafts for different episodes, provided they share the previous episode's ending state.
- Keyframes or video jobs for different generation segments after the directing plan is locked.

Cannot run in parallel:

- Mass-producing all character assets before the outline is locked.
- Script and directing both changing story facts for the same scene.
- Director and storyboard independently deciding the same shot design.
- Submitting paid video jobs in bulk before the pilot is confirmed.
