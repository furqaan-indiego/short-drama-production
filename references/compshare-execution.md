# CompShare H3 execution contract

Use this only when the project explicitly selects CompShare as its H3 provider. The target model remains MiniMax-H3, but the endpoint, key, and job client differ from the MiniMax Official API.

## Credentials and client

- Read credentials in order from `COMPSHARE_H3_API_KEY`, `COMPSHARE_H3_KEY_FILE`, and `~/.codex/secrets/compshare-h3.key`.
- Do not read or request `MINIMAX_API_KEY`; never write any key to project JSON, logs, reports, or chat.
- Use the included `scripts/compshare-h3.py` client and `https://cp.compshare.cn/minimax/v2/video_generation`. `job-export-compshare` supports reference-image jobs only. Route jobs containing reference audio or video through the MiniMax Official adapter; do not silently drop media.

## Create jobs from a production package

```bash
node scripts/production-kit.mjs jobs-sync-package <production.json> \
  --manifest <storyboard/h3-package/manifest.json> \
  --segments E01-16 --provider compshare \
  --depends storyboard,frames-pilot-e01-16 --duration-policy nearest

node scripts/production-kit.mjs job-approve <production.json> \
  --id H3CS-E01-16 --by user --note <current-cost-and-inputs-confirmed>

node scripts/production-kit.mjs job-export-compshare <production.json> \
  --id H3CS-E01-16 --out <storyboard/h3-package/jobs/E01-16.compshare.json>
```

Specify segments explicitly; missing reference images are a failure. Create only one pilot job at a time by default. If a storyboard's total duration is fractional, quantize it to an integer from 4–15 seconds and preserve its source duration and adjustment in both the control layer and the CompShare job. Export only after `job-approve`; the client checks `sourceStatus=approved` and `costApproved=true` in the exported file, so stale files must be re-exported.

## No-cost preflight

For actual H3 submissions, CompShare limits the combined text (prompt plus `promptSuffix`) to 5,000 Unicode characters, lower than the MiniMax Official endpoint's 7,000-character limit. Preflight, approval, and submission must validate the combined text, not just the main prompt.

To enable server-side prompt optimization, set `"useContextIr": true` on the control-layer job. The exported CompShare job preserves the field and the execution client sends `"use_context_ir": true` at the request top level. Omitting it defaults to `false`. Comparison tests must use a new job ID and output path; never overwrite the original final output.

MiniMax Official treats Context-IR as an important part of the full H3 workflow and recommends using it in the pipeline. This project also uses the official `h3-prompt-writing` skill to create structured execution prompts, so it uses a project-level policy instead of always enabling or always disabling it: `off`, `pilot`, `selective`, or `on`. New projects default to `pilot`; after it benefits movement-heavy pilots, use `selective` for comparable segments. Precise text, complex hands, strict axis control, or continuity of the same object across shots still require shot-by-shot judgment.

Final Ref2VA execution prompts retain the official six-part English format. Non-English content may be used in upstream briefs, dialogue, and visible text; a "free-form non-English brief + Context-IR" is a valid experiment, not the default production format. When testing language, change only `promptLanguage`; do not also swap reference images, rewrite the shot, or change duration.

For each A/B test, record the actual change in `experiment.changedVariables` on the job. If more than one variable changes, you may say only that an overall alternative won; you may not attribute the result solely to Context-IR, language, or reference count. Once a job completes, compare the returned state prompt with the source prompt character by character. If they are identical, that proves only that the API echoed the input; it does not prove that internal optimization text was received. Judge with a video A/B test.

```bash
python scripts/compshare-h3.py preflight --job <job.json>
python scripts/compshare-h3.py submit --job <job.json> --dry-run
```

Preflight must confirm aspect ratio, resolution, integer duration, reference-image count and hashes, prompt, and output path. `dry-run` redacts media addresses and does not create an external job.

## Spending boundary

Before a real `submit`, all of the following must be true: the current artifact is approved, the control-layer job has cost authorization, the user explicitly agrees to submit this job ID now, and the command includes `--confirm-submit <sourceJobId>`. After a successful submission, query only the original job. Do not automatically retry or expand a batch after failure. Cancelling a job also requires `--confirm-cancel <task-id>`.
