# Fish Audio character voice-master contract

Read this page when using Fish Audio to discover voices, generate auditions, clone an authorized voice, create a voice master, or hand a voice asset to H3. Fish Audio is an external service; obtain authorization for the current action before querying, generating, or uploading.

## 1. Production role

Fish Audio does not default to line-by-line dubbing of the full drama. Prioritize it for:

- Discovering 1–4 evaluation candidates from the public voice library.
- Generating blind-listening WAV files with the same non-story audition line.
- Turning owned or authorized recordings into a private voice ID.
- Generating a stable 6–12-second voice master for a main character.
- Generating whole lines that must be word-perfect, including amounts, names, spells, and paid-point dialogue.

For normal dialogue, prefer H3 `h3-native-reference` with an approved master as `reference_audio`; this balances lip sync, performance, and cost.

## 2. This adapter's capability boundary

This skill uses only these endpoints from Fish's public OpenAPI:

- Public voice search: `GET https://api.fish.audio/model`.
- Voice detail: `GET https://api.fish.audio/model/{id}`.
- Voice-clone creation: `POST https://api.fish.audio/model`.
- Speech generation: `POST https://api.fish.audio/v1/tts`.
- Credentials: `FISH_API_KEY`, `FISH_API_KEY_FILE`, or `~/.codex/secrets/fish.key`.

Other Fish capabilities are outside the current adapter. Even if the official OpenAPI exposes them, do not improvise calls without the corresponding script, confirmation gate, and tests. For an original voice identity, obtain `reference_id` first in Fish's official UI or another authorized workflow, then hand it to this script; you can also use owned or authorized recordings to create a private model.

Authoritative references:

- <https://api.fish.audio/openapi.json>
- <https://docs.fish.audio/features/voice-cloning>
- <https://docs.fish.audio/api-reference/endpoint/openapi-v1/text-to-speech>
- <https://docs.fish.audio/developer-guide/models-pricing/pricing-and-rate-limits>
- <https://fish.audio/terms/>

Models, free-tier duration, prices, retention, and commercial terms can change; recheck before every production run.

## 3. Upgrade path from free to paid

Register `s2.1-pro-free` assets as `licenseScope=evaluation-only`. They may be used for internal auditions, character voice selection, and H3 pilots, but not commercial delivery. If the public-voice API returns `licensed=false`, switching to paid TTS does not automatically grant commercial voice rights.

When moving into commercial production:

1. Select a voice that Fish explicitly licenses, or create a private model from owned or authorized recordings.
2. Regenerate the same `voiceAssetId` with a paid model that has commercial rights.
3. Record the model, voice ID, generation time, proof of rights, and new SHA-256.
4. Run `voice-approve` again; the old hash invalidates automatically.
5. Refresh and reapprove every H3 job that references the voice.

Do not merely change a JSON label while reusing a free file; regenerate the real audio.

## 4. Included commands

Every command defaults to a no-network dry run. It contacts Fish only when both `--execute --confirm <id>` are present. The script uses system `curl` for Windows system-proxy compatibility; it sends the key only as a request header and never writes it to logs or artifacts.

Discover public voices:

```bash
node scripts/fish-voice.mjs discover \
  --id C01-search \
  --title "confident mature woman" --language en --count 20 \
  --out <C01-public-voices.json>
```

Use 1–4 `reference_id` values to generate same-line audition candidates:

```bash
node scripts/fish-voice.mjs audition \
  --id C01-audition \
  --reference-ids <id1,id2,id3> \
  --text "Put the proposal on the table. We are discussing facts, timing, and responsibility." \
  --out <candidate-dir> \
  --model s2.1-pro-free
```

`audition` obtains each source voice's title, visibility, and `licensed` marker, generates standard 44.1 kHz PCM WAV, fixes the streaming WAV length header, and writes candidate JSON. Candidates are always registered as `evaluation-only`, `humanApproval=pending`, and `productionExportAllowed=false`.

Create a private voice ID from owned or authorized recordings:

```bash
node scripts/fish-voice.mjs clone \
  --id C01-private \
  --sample <authorized-sample.wav> \
  --title "C01 private voice" \
  --visibility private \
  --out <C01-fish-voice.json>
```

Generate a master and register it automatically in `production.json`:

```bash
node scripts/fish-voice.mjs master \
  --production <production.json> \
  --id V-C01-MASTER \
  --character C01 \
  --reference-id <fish-reference-id> \
  --text "I know this is not that simple, but we still have to make the truth clear." \
  --out <voices/C01-master.wav> \
  --model s2.1-pro-free \
  --rights unknown
```

After confirming the dry run, sent text, output location, scope, and external action, append:

```text
--execute --confirm <this-command-id>
```

Do not automatically batch-generate, auto-retry, or use a project's original script as external audition text. Prefer a generic line that tests the character's traits.

## 5. Candidate review

For every character, compare at least:

- Credibility of age and identity.
- Resonance placement, pitch, breath, and accent.
- Naturalness and articulation at normal speaking speed.
- Range for restrained, angry, sad, and quiet delivery.
- Distinctiveness from other main characters.
- Timbre stability across multiple generations.

Keep the final master to one person, dry voice, no music, and no reverb; 6–12 seconds is recommended. Listen manually after WAV output, then run `voice-approve`. Keep candidate WAV files, Fish IDs, source licensing, request text, model, SHA-256, and rights scope on record.

## 6. Prohibited actions

- Calling a guessed endpoint that does not appear in the official OpenAPI.
- Marking free assets or public voices with `licensed=false` as `commercial`.
- Cloning a real person, actor, streamer, or public figure without consent.
- Publishing a private character voice as `public`.
- Approving a character master without listening to it.
- Changing only the model field after a free tier ends rather than regenerating the file.
- Keeping H3 native audio and Fish post TTS for the same line at once.
