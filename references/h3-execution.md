# MiniMax H3 Official API execution contract

Read this page only when the user explicitly requests H3-video preflight, submission, querying, or downloading. The API creates external state and cost; completing a storyboard does not authorize submission.

## 1. Current API

- Create: `POST https://api.minimax.io/v2/video_generation`
- Query: `GET https://api.minimax.io/v2/query/video_generation/{task_id}`
- Model: `MiniMax-H3`
- Credentials: `MINIMAX_API_KEY`, `MINIMAX_API_KEY_FILE`, or `~/.codex/secrets/minimax.key`

Authoritative references:

- <https://platform.minimax.io/docs/api-reference/video-generation-v2-create>
- <https://platform.minimax.io/docs/api-reference/video-generation-v2-query>

Recheck the official pages before production work. If parameters change, update the adapter and tests first.

## 2. Included adapter

`scripts/h3-official.mjs` reads `production.json.jobs` directly and supports:

- `text`, `reference_image`, `reference_video`, and `reference_audio`.
- `first_frame` / `last_frame`.
- Local images, video, and audio converted to Data URLs; it rejects request bodies over 64 MB and requires stable public URLs instead.
- Preflight for a 7,000-character prompt limit, media formats, per-file sizes, count, duration, and mutually exclusive modes.
- Project-level `16:9` aspect ratio through Ref2VA; first/last-frame mode forces `adaptive`, with actual aspect ratio determined by the input frames.
- Submission, querying, polling, downloading, output SHA-256, and writing status back to `production.json`.

Local media enters the request body and the external API. Real-person images, video, and voices require appropriate rights.

## 3. Safe submission sequence

```bash
node scripts/production-kit.mjs validate <production.json>
node scripts/h3-official.mjs preflight <production.json> --id <job-id>
node scripts/h3-official.mjs dry-run <production.json> --id <job-id>
node scripts/production-kit.mjs job-approve <production.json> --id <job-id> --by user
node scripts/h3-official.mjs submit <production.json> --id <job-id> --confirm-submit <job-id>
node scripts/h3-official.mjs wait <production.json> --id <job-id> --poll 10 --timeout 3600
```

`--confirm-submit` must exactly match `job-id`. Approve only one pilot by default. Once the API returns a `task_id`, do not blindly submit again even if the connection breaks; query the original task first.

## 4. Status semantics

- Successful creation: `job.status=submitted`; record `execution.taskId`.
- `queued/running`: write back `running`.
- `succeeded`: download to `outputPath` and calculate `outputSha256`.
- `failed/cancelled`: stop; do not automatically retry paid work.

API success proves only that file generation completed. Character, voice, lip sync, dialogue, action, cut points, and aspect ratio still need post-production work and human directorial QC.
