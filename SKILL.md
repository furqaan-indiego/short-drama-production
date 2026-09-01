---
name: short-drama-production
description: Coordinate AI short-drama stages, dependencies, approvals, H3 jobs, voice assets, rough cuts, and QC; use production.json to track rework; defaults to 16:9. Use for full-drama production, continuing a project, status checks, or upstream-change impact analysis. Use the corresponding specialist skill when creating only an outline, characters, art, script, or storyboard.
license: Apache-2.0
---

# Short Drama Production

This is the production-control layer. It does not replace a writer, director, art department, or storyboard artist. It routes stages and manages state, dependency hashes, approvals, spending boundaries, and executable jobs.

All paths are relative to this skill directory. Set the working directory to this directory when running scripts; pass absolute paths for project files.

## Read as needed

- Creating, continuing, or changing a project: read `references/pipeline.md` and `references/schema.md`.
- Realism or functional locations: read `references/reality-grounding.md` before art generation.
- Entering directing or technical storyboarding: read `references/director-storyboard-handoff.md`.
- Dialogue, voice identity, or Fish Audio: read `references/sound-production.md`; read `references/fish-voice.md` before calling Fish.
- Calling MiniMax Official H3: read `references/h3-execution.md`.
- Calling CompShare H3: read `references/compshare-execution.md`.
- Entering rough-cut or acceptance work: read `references/post-and-qc.md`.
- Changing aspect ratio or producing derivatives: read `references/landscape-16x9.md`.

When writing, revising, or reviewing H3 prompts, use the available official `h3-prompt-writing` skill. If it is unavailable, stop at the technical storyboard; do not invent an approximate format. Verify the provider's current official documentation before submission.

## Core rules

1. `production.json` is the source of state; specialist JSON files are the source of content. Do not copy large bodies of content.
2. After an upstream file or dependency hash changes, run `refresh`; affected downstream artifacts must be reapproved.
3. Models handle creative and aesthetic work; scripts validate only IDs, dependencies, hashes, durations, modes, references, and authorization.
4. Paid submission, batch jobs, retries, publishing, and replacement of final output require the user's explicit authorization for the current action. Query jobs already created; do not blindly resubmit.
5. Start with one high-exposure pilot, then expand to a scene or episode. By default, scripts, directing, and storyboards are batched in groups of 1–3 episodes.
6. New projects default to 16:9, 1920×1080, 24 fps, and `landscape-ensemble`; changing aspect ratio stales every non-source artifact.
7. For reality-based material, verify function, equipment, topology, human flow, and operating state first. An "empty shot" cannot erase real required equipment or signs of life.
8. Storyboard-image prompts come before candidate assets; final H3 prompts come after asset acceptance. Incorrect poses, hand assignment, support points, or unreadable information graphics must not enter a reference pack.
9. Route Ref2VA separately from I2VA/FL2VA/L2VA. Multiple semantic references are not keyframes rigidly pinned to edit points.
10. Describe in-frame movement and camera movement separately. Increase pace through retiming, not by globally speeding up final output.
11. New Context-IR projects start at `pilot`. Change only one variable per A/B test; mixed-variable results can establish only that the whole alternative won.
12. Final H3 execution prompts follow the official English structure; retain the appropriate source language in creative briefs, dialogue, lyrics, and visible text where needed.

## Production flow

```text
Brief → Outline → Characters / Art → Script → Directing → Technical storyboard
      → H3 pilot → Batch generation → Rough cut / Sound / Subtitles → QC → Delivery
```

Choose exactly one directing-to-technical-storyboard route:

- **Director bridge:** When `director-package.json` already exists, use `storyboard-bridge.mjs` to preserve shot intent and audit deviations, then use `jobs-sync`.
- **Standard storyboard package:** When a `manifest.json` from `novel-storyboard export` already exists, use `jobs-sync-package` directly and do not pass through the bridge.

If a specialist skill is missing, manually create the same JSON contract and record `producer` as `manual`; do not claim to have the missing specialist quality gate.

## Core commands

```bash
node scripts/production-kit.mjs init <project-dir> --title <title> --source <source-file> --aspect 16:9
node scripts/production-kit.mjs status <project>/production.json
node scripts/production-kit.mjs validate <project>/production.json
node scripts/production-kit.mjs register <production.json> --id <id> --kind <kind> --stage <stage> --path <file> --depends <ids>
node scripts/production-kit.mjs refresh <production.json>
node scripts/production-kit.mjs approve <production.json> --id <artifact-id> --by user --note <confirmation>
node scripts/production-kit.mjs render <production.json> > production-report.md
```

See `references/director-storyboard-handoff.md` and `references/compshare-execution.md` for commands for the two storyboard-ingestion routes. Run `approve` or `job-approve` only when the user has confirmed the current hash. A passing `validate` result does not establish that performance, voice, or aesthetics are acceptable.

## Optional execution adapters

- MiniMax Official H3: `scripts/h3-official.mjs`, supporting multimodal references, preflight, explicit confirmed submission, polling, and downloads.
- CompShare H3: `scripts/compshare-h3.py`; export first with `production-kit.mjs job-export-compshare`. The current adapter supports reference-image jobs only.
- Fish Audio: `scripts/fish-voice.mjs`, supporting dry runs, public-voice discovery, auditions, authorized cloning, and voice-master registration.
- Rough cuts: `scripts/post-kit.mjs` creates a sequential edit plan; only `--execute` invokes local FFmpeg and writes output.

Keys must come only from environment variables or user-local secret files; never write them to a project, log, or repository. Free or unlicensed-source voices can only be registered as `evaluation-only`.

## Boundaries

This skill delivers `production.json`, status reports, auditable jobs, sequential rough-cut plans, and QC/rework records. Cross-model asset generation, lip-sync repair, source separation, complex multitrack editing, color grading, and frame-by-frame visual inspection are out of scope; register external tools as independent artifacts.

When the user asks only for status, remain read-only. Do not advance creative work or call external services without authorization.
