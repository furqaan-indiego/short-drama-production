# H3 sound production and character-voice contract

## 1. Core decision

The default route for a fixed character is `h3-native-reference`: not allowing H3 to invent a new voice freely for every segment, and not defaulting to post-production replacement. H3 Ref2VA can bind `<Audio N>` to `<Subject N> (Sx)` and use the reference person's timbre and delivery to generate new dialogue.

Official references:

- H3 native audio-video, input count, duration, and language specifications: <https://www.minimax.io/news/minimax-h3-open-source>
- H3 API `reference_audio`, mutually exclusive modes, and media limits: <https://platform.minimax.io/docs/api-reference/video-generation-v2-create>
- Voice binding and `reference` / `partially_copy` / `fully_copy` in all-reference mode: <https://huggingface.co/MiniMaxAI/MiniMax-H3/blob/main/docs/VIDEO_PROMPT_WRITING_GUIDE_ref_en.md>

Recheck these pages before production. If the latest official documentation changes, follow it and update this contract.

The production-control `scripts/h3-official.mjs` already submits `reference_audio` together with images/video to the Official V2 API. See `references/h3-execution.md` for production steps, credentials, and status writeback. The older reference-image-only API script cannot support a fixed-character voice route.

## 2. Four-layer sound decision

Do not reduce all sound to one `audio=true` flag. Decide each segment separately:

- `dialogueRoute`: how dialogue is produced.
- `ambienceRoute`: room tone and continuing environmental sound.
- `foleyRoute`: footsteps, clothing, props, and impacts.
- `musicRoute`: score heard by the audience but not the characters.

Default:

```text
dialogue = h3-native-reference
ambience = h3-native
foley = hybrid
music = post
```

H3 can generate music natively, but independent generation across segments causes shifts in melody, key, tempo, and loudness. A serialized short drama defaults to unified music laid in during post-production.

## 3. Dialogue-route selection

### `h3-native-reference`

Use for normal character dialogue, close performance, and segments that need natural lip sync.

Requirements:

- The character has an approved voice master.
- H3 uses Ref2VA.
- `reference_audio` enters with a character image/video.
- The prompt explicitly binds Subject, Speaker, and Audio.
- `retention_analysis` uses `reference`, making clear that the original signal is not copied, only its timbre and delivery are referenced.

```text
<Audio 1> is the voice-timbre reference for <Subject 1> (S1).

<Audio 1>: reference - the target speaker follows <Audio 1>'s
voice timbre and controlled delivery without copying the original signal.

[Shot 1] <Subject 1> (S1) speaks with restrained anger,
<d>[English]I will not sign this contract.</d>
```

### `tts-guided-h3`

Use for amounts, names, slogans, spells, paid-point dialogue, crying/shouting rhythm, or any performance that must be word-perfect.

Generate accurate dialogue audio with the fixed character voice first, then use it as H3 `reference_audio`:

- `fully_copy`: the input audio is the complete target track.
- `partially_copy`: reuse the dialogue layer or part of it while allowing H3 to add ambience and action sound.
- `reference`: borrow only timbre and delivery; it does not guarantee original waveform or duration.

Do not mistakenly use `reference` when exact dialogue is required.

### `tts-post`

Use for narration, inner monologue, phone voice, distant PA announcements, repairs after H3 audio fails, or jobs that must use first/last-frame anchors and therefore cannot use reference audio simultaneously.

The H3 prompt must not include the same `<d>` line of dialogue. Prefer asking the model not to generate narrative music, avoiding post-production separation of mixed audio tracks.

### `h3-native-free`

Use only for temporary pilots, anonymous crowd noise, or a character whose voice identity the user explicitly accepts as unstable. Do not default to it for main characters.

## 4. Voice-master creation

Create one stable master for every main speaking character:

- Official hard range: 2–15 seconds; production recommendation: 6–12 seconds.
- One person, dry voice, no music, no room reverb, and no obvious background noise.
- Include normal speech rate and full vowels/consonants; do not use all shouting or whispering.
- Specify perceived age, pitch range, breath, accent, pace, and end-of-sentence habit.
- Use synthetic, owned, licensed, or consented voices; record `rights`.

Use the same file and SHA-256 for the same character across segments. For angry, crying, or whisper variants, retain the same master identity and register variants as `performance-reference`; do not replace the master.

Fish Audio can produce masters. When using it, follow `references/fish-voice.md` completely: free `s2.1-pro-free` generates evaluation assets only; before commercial delivery, regenerate the same voice asset with a paid model. Normal dialogue still preferentially uses H3 native generation referencing the master.

## 5. H3 reference budget

Current official API limits mean:

- At most three audio references, so at most three independent voices can bind stably.
- Reference audio cannot be input alone; it requires a reference image or reference video.
- Using reference audio enters Ref2VA and cannot be combined with `first_frame` / `last_frame`.

Priority order for dialogue scenes with more than four people:

1. Split into two-person or three-person relationship shots by conflict.
2. Move minor characters off-camera and use post voice.
3. Merge group responses into non-identified crowd sound.
4. Do not sacrifice the protagonist's voice reference to cover unrelated characters.

## 6. Voice continuity across segments

The same reference audio does not automatically guarantee 100% consistency across separate jobs. Accept every generated segment for:

- Timbre similarity: perceived age, resonance placement, pitch, and breath.
- Linguistic accuracy: omitted words, wrong words, swallowed syllables, and accent.
- Performance continuity: whether emotion and rate connect with adjacent shots.
- Technical continuity: loudness, background noise, room tone, and stereo image.
- Lip sync: openings, closings, pauses, and audio-video cut points.

When a result fails, determine whether the cause is the voice reference, prompt, dialogue length, or model randomness. Do not pay repeatedly in the hope of getting lucky.

## 7. Prohibited mixing

- Keeping H3 native audio and overlaying post TTS for the same line.
- Using a finished clip containing music and multiple voices as one character's voice master.
- Changing a voice master every episode.
- Giving H3 reference audio without binding it to a specific Subject/Speaker in the prompt.
- Planning unified post-production music while allowing each segment to generate a separate complete theme.
- Using an unlicensed real person's voice in commercial production.
