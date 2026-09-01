# Generation, post-production, and finished-video QC

## 1. Pilot strategy

Choose the first paid job for the segment most likely to expose system problems, not the simplest empty establishing shot. It should include:

- A clearly visible protagonist face and fixed costume.
- One line of spoken dialogue and a reference voice.
- One motivated camera move.
- A hand prop or character interaction.
- A set where lighting and visual style can be judged.

Approve a scene or episode only after the pilot passes character consistency, voice, lip sync, action, camera movement, and visual style.

## 2. Generation-job acceptance

Technical:

- File decodes; resolution, aspect ratio, frame rate, and duration are correct.
- No black frames, duplicate frames, freezes, broken audio, clipping, or obvious encoding damage.
- Output file maps to the job ID, prompt, and reference-image hashes.

Visual:

- Face, hairstyle, costume, perceived age, and body type continue correctly.
- Hands, props, text, and mirrors are acceptable.
- Blocking, screen direction, eyelines, and action phase are editable.
- Shot size, composition, and camera movement meet directorial intent.
- Subject, prop, and environment movement begin, develop, and land in an editable state as planned; do not mistake camera movement for completed in-frame movement.
- Rhythm acceptance records, item by item, when information first becomes legible, redundant dwell after comprehension, and turning-point reaction length. Prefer rearranging shots to speed up pacing; do not globally speed up final output.

Sound:

- Dialogue is word-accurate and the timbre belongs to the character.
- Mouth opening, pauses, closing, and lip motion broadly align.
- Environmental space matches the image.
- Loudness, background noise, reverb, and timbre connect across segments.
- Do not retain randomly generated in-segment music that cannot continue.

## 3. Post-production order

1. Build the image rough cut at the director's cut points.
2. Correct action phase, reaction duration, and J-cuts / L-cuts.
3. Decide the dialogue route; when replacing failed dialogue, deal with the original mixed track first.
4. Lay unified ambience and necessary foley.
5. Unify score and segment motifs.
6. Add subtitles, opening/closing material, and platform safe areas.
7. Apply basic color and match brightness between shots.
8. Check loudness, peaks, channel layout, and export.

Do not use music to hide rhythm problems first, and do not polish every sound before the image is locked.

### Included rough-cut tool

`scripts/post-kit.mjs` implements the first automation layer:

- Collects only generated segments where `status=succeeded`, sorted by episode and `sequence`.
- Locks input-file SHA-256, expected duration, and output path to create `edit-plan.json`.
- Uses ffprobe to check decodability, video/audio streams, aspect ratio, and frame rate.
- Generates an FFmpeg filter graph that normalizes segments through `contain-pad` to the project's delivery size, 24 fps, 48 kHz stereo, then concatenates them.
- Checks rough-cut output for dimensions, audio/video streams, and total duration.

```bash
node scripts/post-kit.mjs plan <production.json> --out <edit-plan.json>
node scripts/post-kit.mjs preflight <edit-plan.json>
node scripts/post-kit.mjs assemble <edit-plan.json>
node scripts/post-kit.mjs assemble <edit-plan.json> --execute
node scripts/post-kit.mjs qc <edit-plan.json>
```

Without `--execute`, it only prints the command and does not create a rough cut. The current workstation must provide FFmpeg/ffprobe. If they are absent, the plan can still be created, but codec preflight and actual assembly will explicitly degrade or stop.

## 4. Five finished-video QC categories

### Narrative

- Does the cold open's promise become concrete in the first few beats?
- When watched muted, are objective, obstacle, and power change understandable?
- Are payoffs and evidence clear without subtitles teaching the audience what happened?
- Does the last image create specific suspense?

### Directing

- Are medium-close and close shots reserved for turns, evidence, or reactions?
- Does camera movement have an action or information trigger?
- Do reaction shots change the situation?
- Are axis, eyelines, and screen direction continuous?

### Asset continuity

- Character identity, wardrobe, wounds, hair/makeup, and held-object state.
- Set anchors, time of day, weather, and lighting.
- Controller and state arc of narrative props.

### Sound

- Timbre, language, emotion, and dialogue accuracy.
- Loudness, room tone, music continuity, and dialogue intelligibility.
- No doubled dialogue, leftover model music, or abrupt noise gates.

### Technical and delivery

- Aspect ratio, resolution, frame rate, bitrate, and total duration.
- Subtitle synchronization, typos, safe area, and legibility.
- Filename, version, cover image, platform requirements, and checksums.

## 5. Issue severity

- `critical`: plot error, wrong character, severe dialogue error, unplayable file, or rights issue; delivery is forbidden.
- `high`: failure in key performance, sound, or continuity; rework is required.
- `medium`: local artifact, pacing, or mix issue; rework or explicitly accept.
- `low`: minor flaw that does not affect comprehension; may be recorded and accepted.

Every issue must link episode, timecode, shot/job ID, issue type, evidence, root cause, repair layer, and verification state. Start repair layers at the real upstream cause: asset → script/directing → storyboard/prompt → regeneration → post-production.

## 6. Tool boundary

The included post tool only creates, executes, and performs basic inspection of FFmpeg sequential rough-cut plans. Complex J/L cuts, subtitles, grading, multitrack mixing, lip-sync repair, source separation, and frame-by-frame visual inspection are outside this skill. Register results from external tools as independent artifacts. A valid `production.json` does not mean that the finished video passed human review.
