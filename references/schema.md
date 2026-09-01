# `production.json` contract

`production.json` stores only production state and references. It does not duplicate the body of outlines, scripts, or storyboards.

## 1. Top-level example

```json
{
  "schemaVersion": "1.0",
  "project": {
    "id": "my-drama",
    "title": "My Drama",
    "createdAt": "2026-08-23T00:00:00.000Z",
    "updatedAt": "2026-08-23T00:00:00.000Z",
    "format": {
      "aspectRatio": "16:9",
      "orientation": "landscape",
      "deliveryWidth": 1920,
      "deliveryHeight": 1080,
      "fps": 24,
      "compositionProfile": "landscape-ensemble",
      "safeArea": { "action": 0.95, "title": 0.90 },
      "generationResolution": "768P",
      "episodeCount": null,
      "episodeSeconds": null,
      "targetModel": "MiniMax-H3"
    }
  },
  "policies": {
    "batchEpisodes": 3,
    "pilotJobs": 1,
    "videoProvider": "minimax-official",
    "defaultDialogueRoute": "h3-native-reference",
    "ambienceRoute": "h3-native",
    "foleyRoute": "hybrid",
    "musicRoute": "post",
    "contextIrPolicy": "pilot",
    "paidGenerationRequiresApproval": true
  },
  "artifacts": [],
  "voiceAssets": [],
  "jobs": [],
  "approvals": [],
  "risks": []
}
```

`contextIrPolicy` is one of `off`, `pilot`, `selective`, or `on`. New projects default to `pilot`. After a controlled pilot, change to `selective` or `on` only when comparable shots show measured benefit without losing hard constraints. `selective` means setting it explicitly per job, suitable for dramas where complex movement and risks around precise text, hands, or continuity differ by shot.

New projects use the 16:9 contract above by default. When `aspectRatio` changes, update `orientation`, delivery dimensions, composition configuration, and safe area together from the preset, then stale every non-source artifact. `generationResolution` allows only `768P` / `2K`; it is an H3 generation tier, not the final delivery dimensions.

## 2. Artifacts: `artifacts`

```json
{
  "id": "director-e01-e03",
  "kind": "director",
  "stage": "director",
  "producer": "short-drama-director",
  "path": "director/e01-e03/director-package.json",
  "episodes": "1-3",
  "dependsOn": ["script-e01-e03", "cast", "art"],
  "status": "approved",
  "sha256": "hash-of-current-file",
  "approvedSha256": "hash-of-file-at-approval",
  "approvedDependencyHashes": {
    "script-e01-e03": "hash-of-upstream-at-approval",
    "cast": "hash-of-upstream-at-approval",
    "art": "hash-of-upstream-at-approval"
  },
  "updatedAt": "ISO timestamp",
  "notes": []
}
```

Fields:

- `id`: Stable and project-unique; permits lowercase letters, digits, periods, underscores, and hyphens.
- `kind`: `source`, `outline`, `cast`, `art`, `script`, `director`, `storyboard`, `frames`, `video`, `audio`, `edit`, `qc`, or `delivery`.
- `stage`: The production stage corresponding to `kind`; multiple files may be grouped at one stage when needed.
- `producer`: Specialist skill name or `manual`.
- `path`: A path relative to `production.json`; an external source may use an absolute path.
- `episodes`: A readable range such as `all`, `1`, or `1-3`.
- `dependsOn`: Upstream artifact IDs; must not form a cycle.
- `status`: `planned`, `working`, `review`, `approved`, `stale`, `missing`, `blocked`, `failed`, or `skipped`.

`approve` captures `approvedSha256` and `approvedDependencyHashes`. When `refresh` detects a changed file, it marks it `review`; when it detects a changed upstream dependency, it marks it `stale`.

## 3. Voice assets: `voiceAssets`

```json
{
  "voiceAssetId": "V-C01-MASTER",
  "characterId": "C01",
  "path": "voices/C01-master.wav",
  "sha256": "file-hash",
  "language": "en",
  "durationSeconds": 10,
  "sampleType": "voice-master",
  "rights": "synthetic",
  "licenseScope": "evaluation-only",
  "provider": "fish-audio",
  "providerModel": "s2.1-pro-free",
  "providerVoiceId": "Fish reference_id",
  "sourceType": "voice-design-private-clone",
  "status": "approved",
  "notes": "female mezzo voice; restrained; no pronounced rising sentence endings"
}
```

- `sampleType`: `voice-master`, `exact-line`, `performance-reference`, `ambience`, or `music`.
- `rights`: `synthetic`, `owned`, `licensed`, `consented`, or `unknown`.
- `status`: `draft`, `approved`, `rejected`, or `missing`.
- `licenseScope`: `evaluation-only` or `commercial`. `s2.1-pro-free` is forced to `evaluation-only`.
- `provider` / `providerModel` / `providerVoiceId`: Record the generation service, model, and reusable voice ID; never store an API key.
- `sourceType`: For example, `voice-design-private-clone`, `owned-clone`, `licensed-library`, or `manual`.

Real-person audio used in paid jobs must not have `rights=unknown`. A voice master is recommended to be 6–12 seconds of dry voice; the H3 API hard range is 2–15 seconds.

Evaluation voices may be used in internal H3 pilots, but an approved `delivery` must never reference an `evaluation-only` voice. On upgrade, regenerate the WAV and reapprove its hash.

## 4. Generation jobs: `jobs`

```json
{
  "jobId": "H3-E01-C01",
  "episode": 1,
  "clipId": "E01-S01-C01",
  "model": "MiniMax-H3",
  "mode": "h3-ref2va",
  "duration": 8,
  "sourceDurationSeconds": 8.4,
  "durationAdjustmentSeconds": -0.4,
  "durationPolicy": "nearest",
  "sequence": 1,
  "ratio": "16:9",
  "resolution": "768P",
  "useContextIr": false,
  "experiment": {
    "groupId": "E01-01-context-ir",
    "baselineJobId": "H3-E01-C01",
    "hypothesis": "Context-IR improves subject and prop motion without losing posture continuity",
    "changedVariables": ["useContextIr"],
    "result": {
      "winnerJobId": null,
      "observedAdvantages": [],
      "causalConclusion": "pending"
    }
  },
  "provider": "minimax-official",
  "dialogueRoute": "h3-native-reference",
  "ambienceRoute": "h3-native",
  "musicRoute": "post",
  "promptPath": "storyboard/E01-01/prompt.md",
  "dependsOn": ["storyboard-e01-e03", "frames-e01-e03"],
  "references": [
    {
      "refId": "IMG-C01",
      "role": "reference_image",
      "path": "cast/images/C01.png",
      "characterId": "C01"
    },
    {
      "refId": "AUD-C01",
      "role": "reference_audio",
      "path": "voices/C01-master.wav",
      "voiceAssetId": "V-C01-MASTER",
      "durationSeconds": 10,
      "relation": "reference"
    }
  ],
  "speakers": [
    {
      "characterId": "C01",
      "speakerId": "S1",
      "voiceAssetId": "V-C01-MASTER",
      "audioRefId": "AUD-C01"
    }
  ],
  "costApproved": false,
  "status": "planned",
  "outputPath": "video/E01-C01.mp4",
  "inputHashes": {},
  "attempt": 0,
  "execution": {
    "provider": "minimax-official",
    "taskId": null
  },
  "qc": {
    "status": "pending",
    "issues": []
  }
}
```

`dialogueRoute`:

- `h3-native-reference`: H3 generates new dialogue using a reference voice master.
- `h3-native-free`: H3 generates its own voice; use only for a character without a fixed voice or a temporary test.
- `tts-guided-h3`: Accurate dialogue audio exists first; H3 then copies/references it and generates performance.
- `tts-post`: H3 generates no dialogue; dub in post-production.
- `silent`: No dialogue.

Job statuses: `planned`, `approved`, `submitted`, `running`, `succeeded`, `failed`, `cancelled`, or `rejected`.

- `sequence`: Whole-project rough-cut order; sort an episode by this value.
- `ratio`: Ref2VA inherits project aspect ratio; I2VA / FL2VA must use `adaptive`, with actual aspect ratio determined by input frames.
- `resolution`: `768P` or `2K`.
- `provider`: `minimax-official` or `compshare`. Sharing the MiniMax-H3 model name does not mean they share keys or submission endpoints.
- `useContextIr`: Optional boolean. When `true` for CompShare, send `use_context_ir=true` at the request top level for Context-IR prompt optimization first. Comparison generations need independent job IDs and output paths.
- `experiment`: Optional A/B audit. `changedVariables` uses `promptText`, `promptLanguage`, `referenceSet`, `useContextIr`, `duration`, `resolution`, or `seed`. When more than one variable changes, you may compare overall alternatives, but the validator marks `EXPERIMENT_CONFOUNDED`; do not attribute the win to one parameter.
- `sourceDurationSeconds` / `durationAdjustmentSeconds` / `durationPolicy`: Audit record of quantizing fractional storyboard duration to integer H3 duration; do not silently round.
- `execution`: External task ID, remote status, usage, and submission/download time; never store an API key.
- `outputSha256`: Record after a successful download for edit-plan and rework tracking.

H3 Ref2VA contract:

- `duration` is an integer from 4–15 seconds.
- `reference_image` ≤ 9.
- `reference_video` ≤ 3; each is 2–15 seconds, total ≤ 15 seconds.
- `reference_audio` ≤ 3; each is 2–15 seconds, total ≤ 15 seconds.
- Total reference files ≤ 12.
- When `reference_audio` is present, there must also be a reference image or reference video.
- Reference-character mode is mutually exclusive with `first_frame` / `last_frame`.
- Each `h3-native-reference` speaker binds to an approved voice asset and an actual `reference_audio`.
- `tts-guided-h3` uses `partially_copy` or `fully_copy`; normal voice masters use `reference`.
- `submitted`, `running`, and `succeeded` require cost approval already.
- Final execution prompts use the official English structure from `h3-prompt-writing`; retain dialogue, lyrics, and visible text in their appropriate source language. A free-form non-English brief plus Context-IR is another experiment condition; do not change it together with reference set, duration, or director shot and then attribute the result to language.

## 5. Director-bridge storyboard

The `storyboard.json` generated by `storyboard-bridge.mjs` adds these fields beyond the original storyboard core:

```json
{
  "schemaVersion": "1.1-director-bridge",
  "aspectRatio": "16:9",
  "compositionProfile": "landscape-ensemble",
  "handoff": {
    "sourceDirector": "director-package.json",
    "sourceScript": "script.json",
    "policy": "director-authoritative"
  },
  "episodes": [{
    "ep": 1,
    "segments": [{
      "id": "E01-01",
      "sourceClipId": "E01-S01-C01",
      "generationMode": "h3-ref2va",
      "references": [],
      "speakerBindings": [],
      "promptPath": "h3/E01-01/prompt.md",
      "deviations": [],
      "cuts": [{
        "sourceShotId": "E01-S01-C01-SH01",
        "dramaticPurpose": "original director-shot purpose",
        "size": "wide",
        "angle": "eye",
        "lensMm": 35,
        "cameraPlan": {},
        "screenDirection": "left-to-right",
        "axisAction": "keep",
        "directorIntent": {
          "originalSize": "MWS",
          "angle": "eye",
          "lensMm": 35,
          "camera": {},
          "screenDirection": "left-to-right",
          "axisAction": "keep"
        }
      }]
    }]
  }]
}
```

The bridge quality gate keys on `sourceShotId` to check coverage, beats, dramatic purpose, shot size, angle, focal length, camera movement, screen direction, and axis. `directorIntent` is an immutable original-director snapshot. When a technical field must change, add a `deviations` entry that specifies `fields`, reason, original plan, change, dramatic impact, status, and approver. Only deviations with `status=approved` and a non-empty `approvedBy` pass the gate.

## 6. Approvals and risks

Approval record:

```json
{
  "approvalId": "APR-0001",
  "artifactId": "outline",
  "by": "user",
  "at": "ISO timestamp",
  "sha256": "hash-of-approved-object",
  "dependencyHashes": {},
  "note": "Confirmed that the subplot was removed and the main payoff moves to episode 18"
}
```

Risk record:

```json
{
  "riskId": "RISK-001",
  "severity": "high",
  "stage": "generate",
  "status": "open",
  "description": "Four people in one scene exceeds H3's three-reference-audio limit",
  "mitigation": "Split into two-person relationship shots and handle off-camera dialogue in post"
}
```

`severity`: `low`, `medium`, `high`, or `critical`; `status`: `open`, `mitigated`, `accepted`, or `closed`.
