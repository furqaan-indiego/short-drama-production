#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  addJob,
  addVoiceAsset,
  approveArtifact,
  approveJob,
  approveVoiceAsset,
  createManifest,
  exportCompShareJob,
  quantizeH3Duration,
  refreshManifest,
  registerArtifact,
  renderManifest,
  setProjectFormat,
  statusText,
  syncJobsFromH3Package,
  syncJobsFromStoryboard,
  validateManifest
} from "./production-kit.mjs";
import { bridgeDirectorPackage, validateBridge, writeBridgePack } from "./storyboard-bridge.mjs";
import { buildH3Request, preflightH3Job, redactedPayload } from "./h3-official.mjs";
import { buildEditPlan, ffmpegArgsForEpisode, preflightEditPlan } from "./post-kit.mjs";
import { buildFishTtsRequest, buildVoiceDiscoveryQuery, normalizeWavHeader, registerFishMaster, wavDurationSeconds } from "./fish-voice.mjs";

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "short-drama-production-selftest-"));

function write(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

function writeSilentWav(file, seconds = 8, sampleRate = 8000) {
  const dataBytes = Math.round(seconds * sampleRate * 2);
  const buffer = Buffer.alloc(44 + dataBytes);
  buffer.write("RIFF", 0, "ascii");
  buffer.writeUInt32LE(36 + dataBytes, 4);
  buffer.write("WAVE", 8, "ascii");
  buffer.write("fmt ", 12, "ascii");
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36, "ascii");
  buffer.writeUInt32LE(dataBytes, 40);
  write(file, buffer);
}

function setup(name = "fixture", scriptData = { source: "Pilot", episodes: [{ ep: 1, scenes: [] }] }) {
  const root = path.join(tempRoot, name);
  fs.mkdirSync(root, { recursive: true });
  const source = path.join(root, "source.txt");
  const manifestPath = path.join(root, "production.json");
  const outline = path.join(root, "outline.json");
  const script = path.join(root, "script.json");
  write(source, "Source story content");
  write(outline, JSON.stringify({ title: "Pilot", episodes: [{ ep: 1 }] }));
  write(script, JSON.stringify(scriptData));
  const manifest = createManifest({ title: "Pilot", sourcePath: source, manifestPath });
  registerArtifact(manifest, manifestPath, { id: "outline", kind: "outline", stage: "outline", path: outline, dependsOn: ["source"], episodes: "all", producer: "novel-outline" });
  approveArtifact(manifest, manifestPath, "outline", "user", "Outline locked");
  registerArtifact(manifest, manifestPath, { id: "script-e01", kind: "script", stage: "script", path: script, dependsOn: ["outline"], episodes: "1", producer: "novel-script" });
  approveArtifact(manifest, manifestPath, "script-e01", "user", "Episode 1 script locked");
  return { root, source, outline, script, manifestPath, manifest };
}

function bridgeFixture(root) {
  const script = {
    source: "Landscape pilot",
    episodes: [{
      ep: 1,
      targetSeconds: 8,
      scenes: [{
        sceneId: "S01",
        lighting: "night",
        characters: ["C01"],
        props: ["P01"],
        flow: [
          { action: "She pushes the contract back across the table." },
          { speaker: "C01", line: "I will not sign.", delivery: "restrained" }
        ]
      }]
    }]
  };
  const director = {
    schemaVersion: "1.0",
    title: "Landscape Pilot",
    source: "script.json",
    format: { aspectRatio: "16:9", fps: 24, audioRoute: "h3-native-reference", generation: { mode: "h3-ref2va" } },
    episodes: [{
      ep: 1,
      scenes: [{
        sceneId: "E01-S01",
        sourceSceneId: "S01",
        sourceBeats: [
          { beatId: "E01-S01-B001", kind: "action", text: "She pushes the contract back across the table." },
          { beatId: "E01-S01-B002", kind: "dialogue", speaker: "C01", text: "I will not sign." }
        ],
        clips: [{
          clipId: "E01-S01-C01",
          duration: 8,
          dramaticFunction: "The contract action turns into a power reversal through refusal to sign",
          audioPlan: "H3 references character voice timbre; music is added in post",
          referenceMode: "multi-reference",
          references: [
            { refId: "IMG-C01", role: "reference_image", path: "C01.png", characterId: "C01" },
            { refId: "AUD-C01", role: "reference_audio", path: "V-C01-MASTER.wav", voiceAssetId: "V-C01-MASTER", durationSeconds: 10, relation: "reference" }
          ],
          speakerBindings: [{ characterId: "C01", speakerId: "S1", voiceAssetId: "V-C01-MASTER", audioRefId: "AUD-C01" }],
          shots: [
            {
              shotId: "E01-S01-C01-SH01", start: 0, duration: 4, beatRefs: ["E01-S01-B001"], dialogueRefs: [],
              dramaticPurpose: "Use the lateral table relationship to show her first refusal to be controlled", size: "MWS", angle: "eye", lensMm: 35,
              camera: { move: "track", trigger: "contract slides back", path: "short lateral move along the table edge", speed: "slow", endState: "both enter the same lateral relationship" },
              composition: "the two people occupy opposing left/right thirds of the landscape frame", blocking: "she pushes the contract toward the other person", eyeline: "level", screenDirection: "left-to-right", axisAction: "keep", transition: "cut",
              framePrompt: "cinematic film still, wide shot, two people separated across a table", props: ["P01"]
            },
            {
              shotId: "E01-S01-C01-SH02", start: 4, duration: 4, beatRefs: ["E01-S01-B002"], dialogueRefs: ["E01-S01-B002"],
              dramaticPurpose: "Cut close on her restrained refusal to complete the power reversal", size: "CU", angle: "eye", lensMm: 75,
              camera: { move: "static", trigger: "", path: "", speed: "", endState: "" },
              composition: "she is on the left third, with her opponent as soft foreground on the right", blocking: "she does not avert her gaze", eyeline: "level", screenDirection: "neutral", axisAction: "keep", transition: "reaction_cut",
              framePrompt: "cinematic film still, close-up, restrained woman with opponent in soft foreground"
            }
          ],
          modelPrompt: "subject_definitions:\n<Audio 1> is the voice-timbre reference for <Subject 1> (S1).\nsummary:\nA contract refusal reverses power.\nretention_analysis:\n<Audio 1>: reference - preserve voice timbre.\ndetailed_description:\n[Shot 1] Tracking Shot as the contract slides across the table.\n[Shot 2] At 00:04.000, Static Shot on <Subject 1> (S1), <d>[English]I will not sign.</d>\noverall_soundscape:\nQuiet office ambience and paper friction.\nnon_diegetic_music:\nN/A"
        }]
      }]
    }]
  };
  write(path.join(root, "C01.png"), "image");
  return { script, director };
}

function addApprovedVoice(fixture, id = "V-C01-MASTER", character = "C01") {
  const voice = path.join(fixture.root, `${id}.wav`);
  write(voice, `synthetic-audio-${id}`);
  addVoiceAsset(fixture.manifest, fixture.manifestPath, {
    voiceAssetId: id,
    characterId: character,
    path: voice,
    language: "en",
    durationSeconds: 10,
    sampleType: "voice-master",
    rights: "synthetic",
    notes: "test"
  });
  approveVoiceAsset(fixture.manifest, fixture.manifestPath, id, "user", "Voice master confirmed");
  return voice;
}

function addValidJob(fixture) {
  const voice = addApprovedVoice(fixture);
  const image = path.join(fixture.root, "C01.png");
  const prompt = path.join(fixture.root, "prompt.md");
  write(image, "image");
  write(prompt, "[Shot 1] <Subject 1> (S1) speaks, <d>[English]I will not sign.</d>");
  const job = addJob(fixture.manifest, fixture.manifestPath, {
    jobId: "H3-E01-C01",
    episode: 1,
    clipId: "E01-S01-C01",
    mode: "h3-ref2va",
    duration: 8,
    dialogueRoute: "h3-native-reference",
    promptPath: prompt,
    outputPath: path.join(fixture.root, "out.mp4"),
    dependsOn: ["script-e01"]
  });
  job.references = [
    { refId: "IMG-C01", role: "reference_image", path: image, characterId: "C01" },
    { refId: "AUD-C01", role: "reference_audio", path: voice, voiceAssetId: "V-C01-MASTER", durationSeconds: 10, relation: "reference" }
  ];
  job.speakers = [{ characterId: "C01", speakerId: "S1", voiceAssetId: "V-C01-MASTER", audioRefId: "AUD-C01" }];
  approveJob(fixture.manifest, fixture.manifestPath, job.jobId, "user", "Single pilot approved");
  return job;
}

function clone(value) {
  return structuredClone(value);
}

const tests = [];
function test(name, fn) {
  tests.push({ name, fn });
}

test("approved artifact chain validates", () => {
  const fixture = setup("artifact-chain");
  refreshManifest(fixture.manifest, fixture.manifestPath);
  const result = validateManifest(fixture.manifest, fixture.manifestPath);
  assert.equal(result.ok, true, JSON.stringify(result.errors, null, 2));
});

test("new projects default to first-class 16:9 contract", () => {
  const fixture = setup("default-landscape");
  assert.equal(fixture.manifest.project.format.aspectRatio, "16:9");
  assert.equal(fixture.manifest.project.format.deliveryWidth, 1920);
  assert.equal(fixture.manifest.project.format.deliveryHeight, 1080);
  assert.equal(fixture.manifest.project.format.compositionProfile, "landscape-ensemble");
});

test("format changes invalidate every downstream artifact", () => {
  const fixture = setup("format-invalidation");
  const result = setProjectFormat(fixture.manifest, { aspectRatio: "9:16" });
  assert.equal(result.changed, true);
  assert.equal(fixture.manifest.artifacts.find((item) => item.id === "outline").status, "stale");
  assert(fixture.manifest.risks.some((risk) => risk.stage === "ingest" && risk.status === "open"));
});

test("upstream edit makes itself review and downstream stale", () => {
  const fixture = setup("stale-propagation");
  write(fixture.outline, JSON.stringify({ title: "Pilot", changed: true }));
  refreshManifest(fixture.manifest, fixture.manifestPath);
  assert.equal(fixture.manifest.artifacts.find((item) => item.id === "outline").status, "review");
  assert.equal(fixture.manifest.artifacts.find((item) => item.id === "script-e01").status, "stale");
});

test("dependency cycle fails", () => {
  const fixture = setup("cycle");
  fixture.manifest.artifacts.find((item) => item.id === "outline").dependsOn.push("script-e01");
  const result = validateManifest(fixture.manifest, fixture.manifestPath);
  assert(result.errors.some((item) => item.code === "DEPENDENCY_CYCLE"));
});

test("unknown voice rights cannot be approved", () => {
  const fixture = setup("voice-rights");
  const voice = path.join(fixture.root, "voice.wav");
  write(voice, "voice");
  addVoiceAsset(fixture.manifest, fixture.manifestPath, { voiceAssetId: "V-C01", characterId: "C01", path: voice, durationSeconds: 8, rights: "unknown" });
  assert.throws(() => approveVoiceAsset(fixture.manifest, fixture.manifestPath, "V-C01", "user"), /rights/);
});

test("valid H3 native reference job passes", () => {
  const fixture = setup("valid-h3");
  addValidJob(fixture);
  refreshManifest(fixture.manifest, fixture.manifestPath);
  const result = validateManifest(fixture.manifest, fixture.manifestPath);
  assert.equal(result.ok, true, JSON.stringify(result.errors, null, 2));
});

test("reference audio cannot be the sole media input", () => {
  const fixture = setup("audio-only");
  const job = addValidJob(fixture);
  job.references = job.references.filter((ref) => ref.role === "reference_audio");
  const result = validateManifest(fixture.manifest, fixture.manifestPath);
  assert(result.errors.some((item) => item.code === "H3_AUDIO_ONLY"));
});

test("reference and frame modes cannot mix", () => {
  const fixture = setup("mode-mix");
  const job = addValidJob(fixture);
  job.references.push({ refId: "FIRST", role: "first_frame", path: "first.png" });
  const result = validateManifest(fixture.manifest, fixture.manifestPath);
  assert(result.errors.some((item) => item.code === "H3_MODE_MIX"));
});

test("more than three audio references fail", () => {
  const fixture = setup("audio-count");
  const job = addValidJob(fixture);
  for (let index = 2; index <= 4; index += 1) job.references.push({ refId: `AUD-${index}`, role: "reference_audio", path: `v${index}.wav`, durationSeconds: 2, relation: "reference" });
  const result = validateManifest(fixture.manifest, fixture.manifestPath);
  assert(result.errors.some((item) => item.code === "H3_AUDIO_COUNT"));
});

test("submitted job needs cost approval", () => {
  const fixture = setup("cost-approval");
  const job = addValidJob(fixture);
  job.status = "submitted";
  job.costApproved = false;
  const result = validateManifest(fixture.manifest, fixture.manifestPath);
  assert(result.errors.some((item) => item.code === "COST_APPROVAL"));
});

test("speaker must bind approved voice and audio reference", () => {
  const fixture = setup("voice-binding");
  const job = addValidJob(fixture);
  job.speakers[0].audioRefId = "MISSING";
  const result = validateManifest(fixture.manifest, fixture.manifestPath);
  assert(result.errors.some((item) => item.code === "VOICE_BINDING"));
});

test("post TTS rejects native dialogue block", () => {
  const fixture = setup("tts-conflict");
  const job = addValidJob(fixture);
  job.dialogueRoute = "tts-post";
  const result = validateManifest(fixture.manifest, fixture.manifestPath);
  assert(result.errors.some((item) => item.code === "DUPLICATE_DIALOGUE"));
});

test("succeeded job needs output file", () => {
  const fixture = setup("missing-output");
  const job = addValidJob(fixture);
  job.status = "succeeded";
  const result = validateManifest(fixture.manifest, fixture.manifestPath);
  assert(result.errors.some((item) => item.code === "OUTPUT_MISSING"));
});

test("render and status expose operational state", () => {
  const fixture = setup("render");
  addValidJob(fixture);
  const status = statusText(fixture.manifest);
  const report = renderManifest(fixture.manifest, fixture.manifestPath);
  assert(status.includes("H3-E01-C01"));
  assert(report.includes("# Pilot | Short Drama Production Report"));
  assert(report.includes("Voice assets"));
  assert(report.includes("1920×1080"));
});

test("director bridge preserves shot intent and 16:9 contract", () => {
  const root = path.join(tempRoot, "director-bridge");
  fs.mkdirSync(root, { recursive: true });
  const data = bridgeFixture(root);
  const directorPath = path.join(root, "director-package.json");
  const scriptPath = path.join(root, "script.json");
  const boardPath = path.join(root, "storyboard.json");
  write(directorPath, JSON.stringify(data.director));
  write(scriptPath, JSON.stringify(data.script));
  const built = bridgeDirectorPackage(data.director, data.script, { aspectRatio: "16:9", directorPath, scriptPath, storyboardPath: boardPath });
  assert.deepEqual(built.errors, []);
  assert.equal(built.board.compositionProfile, "landscape-ensemble");
  assert.equal(built.board.episodes[0].segments[0].cuts[0].sourceShotId, "E01-S01-C01-SH01");
  const result = validateBridge(built.board, data.director, data.script, { aspectRatio: "16:9" });
  assert.equal(result.ok, true, JSON.stringify(result.errors, null, 2));
  const broken = clone(built.board);
  broken.episodes[0].segments[0].cuts[0].dramaticPurpose = "Changed to an ordinary establishing shot";
  assert(validateBridge(broken, data.director, data.script).errors.some((item) => item.includes("dramaticPurpose")));
  const approvedChange = clone(built.board);
  const segment = approvedChange.episodes[0].segments[0];
  segment.cuts[0].size = "medium";
  segment.deviations.push({ deviationId: "DEV-E01-001", sourceShotId: "E01-S01-C01-SH01", fields: ["size"], reason: "reference-image stability is insufficient for a multi-person wide shot", original: "wide", change: "medium", dramaticImpact: "spatial pressure is reduced", approvedBy: "user", status: "approved" });
  const approvedResult = validateBridge(approvedChange, data.director, data.script);
  assert.equal(approvedResult.ok, true, JSON.stringify(approvedResult.errors, null, 2));
  assert(approvedResult.warnings.some((item) => item.includes("approved technical deviation")));
});

test("storyboard jobs sync into official H3 payload with audio reference", () => {
  const root = path.join(tempRoot, "h3-sync");
  const data = bridgeFixture(root);
  const fixture = setup("h3-sync-project", data.script);
  write(path.join(fixture.root, "C01.png"), "image");
  addApprovedVoice(fixture);
  const directorPath = path.join(fixture.root, "director-package.json");
  const boardPath = path.join(fixture.root, "storyboard.json");
  write(directorPath, JSON.stringify(data.director));
  const built = bridgeDirectorPackage(data.director, data.script, { aspectRatio: "16:9", directorPath, scriptPath: fixture.script, storyboardPath: boardPath });
  assert.deepEqual(built.errors, []);
  writeBridgePack(built.board, boardPath);
  const jobs = syncJobsFromStoryboard(fixture.manifest, fixture.manifestPath, built.board, boardPath, { dependsOn: ["script-e01"], outputDir: path.join(fixture.root, "video") });
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].ratio, "16:9");
  assert.equal(jobs[0].resolution, "768P");
  const request = buildH3Request(fixture.manifest, fixture.manifestPath, jobs[0].jobId);
  assert(request.payload.content.some((item) => item.type === "audio_url" && item.role === "reference_audio"));
  assert.equal(request.payload.ratio, "16:9");
  assert.equal(redactedPayload(request.payload).content.find((item) => item.type === "audio_url").audio_url.url, "<embedded-local-media>");
  const preflight = preflightH3Job(fixture.manifest, fixture.manifestPath, jobs[0].jobId);
  assert.equal(preflight.ok, true, JSON.stringify(preflight.errors, null, 2));
});

test("exported H3 package syncs into a CompShare integer-duration pilot", () => {
  const fixture = setup("compshare-package-sync");
  fixture.manifest.policies.videoProvider = "compshare";
  const packageRoot = path.join(fixture.root, "storyboard", "h3-package");
  const segmentRoot = path.join(packageRoot, "E01-16");
  const prompt = path.join(segmentRoot, "prompt.md");
  const pictures = [1, 2, 3].map((index) => path.join(segmentRoot, `f${index}.png`));
  write(prompt, "[Shot 1] Sparse station ambience, no dialogue.");
  for (const picture of pictures) write(picture, `image-${picture}`);
  const packagePath = path.join(packageRoot, "manifest.json");
  const packageManifest = [{
    segment: "E01-16",
    seconds: 8.4,
    cuts: 3,
    prompt: path.relative(fixture.root, prompt),
    pictures: pictures.map((picture) => path.relative(fixture.root, picture)),
    missing: []
  }];
  write(packagePath, JSON.stringify(packageManifest));
  assert.equal(quantizeH3Duration(8.4, "nearest"), 8);
  assert.equal(quantizeH3Duration(11.9, "nearest"), 12);
  const jobs = syncJobsFromH3Package(fixture.manifest, fixture.manifestPath, packageManifest, packagePath, {
    segments: ["E01-16"],
    provider: "compshare",
    dependsOn: ["script-e01"],
    outputDir: path.join(fixture.root, "video")
  });
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].jobId, "H3CS-E01-16");
  assert.equal(jobs[0].duration, 8);
  assert.equal(jobs[0].durationAdjustmentSeconds, -0.4);
  assert.equal(jobs[0].dialogueRoute, "silent");
  assert.equal(jobs[0].references.length, 3);
  jobs[0].useContextIr = true;
  const externalPath = path.join(packageRoot, "jobs", "E01-16.compshare.json");
  const exported = exportCompShareJob(fixture.manifest, fixture.manifestPath, jobs[0].jobId, externalPath);
  assert.equal(exported.provider, "compshare");
  assert.equal(exported.sourceStatus, "planned");
  assert.equal(exported.costApproved, false);
  assert.equal(exported.minimumReferences, 3);
  assert.equal(exported.duration, 8);
  assert.equal(exported.useContextIr, true);
  assert.equal(fs.existsSync(externalPath), true);
  const result = validateManifest(fixture.manifest, fixture.manifestPath);
  assert.equal(result.ok, true, JSON.stringify(result.errors, null, 2));
});

test("Context-IR experiment records confounded comparisons", () => {
  const fixture = setup("context-ir-experiment");
  fixture.manifest.policies.contextIrPolicy = "selective";
  const baseline = addJob(fixture.manifest, fixture.manifestPath, {
    jobId: "H3-BASELINE", episode: 1, clipId: "E01-01", duration: 8, ratio: "16:9", resolution: "768P",
    provider: "compshare", dialogueRoute: "silent", ambienceRoute: "h3-native", musicRoute: "post",
    promptPath: fixture.source, outputPath: path.join(fixture.root, "baseline.mp4"), dependsOn: []
  });
  baseline.mode = "h3-t2va";
  const variant = addJob(fixture.manifest, fixture.manifestPath, {
    jobId: "H3-VARIANT", episode: 1, clipId: "E01-01-V", duration: 8, ratio: "16:9", resolution: "768P",
    provider: "compshare", dialogueRoute: "silent", ambienceRoute: "h3-native", musicRoute: "post",
    promptPath: fixture.source, outputPath: path.join(fixture.root, "variant.mp4"), dependsOn: []
  });
  variant.mode = "h3-t2va";
  variant.useContextIr = true;
  variant.experiment = {
    groupId: "E01-01-motion",
    baselineJobId: baseline.jobId,
    hypothesis: "the variant improves visible motion",
    changedVariables: ["promptText", "useContextIr"],
    result: { winnerJobId: variant.jobId, observedAdvantages: ["motion"], causalConclusion: "overall variant wins; cause not isolated" }
  };
  const result = validateManifest(fixture.manifest, fixture.manifestPath);
  assert.equal(result.ok, true, JSON.stringify(result.errors, null, 2));
  assert(result.warnings.some((item) => item.code === "EXPERIMENT_CONFOUNDED"));
});

test("Fish free voice becomes an evaluation-only H3-ready master", () => {
  const fixture = setup("fish-master");
  const output = path.join(fixture.root, "voices", "C01-master.wav");
  writeSilentWav(output, 8);
  const query = buildVoiceDiscoveryQuery({ language: "en", count: 3, title: "confident mature woman" });
  assert.match(query, /page_size=3/);
  assert.match(query, /title=/);
  const tts = buildFishTtsRequest({ model: "s2.1-pro-free", text: "I know this is not that simple, but we still need to make the truth clear.", referenceId: "fish-private-C01" });
  assert.equal(tts.licenseScope, "evaluation-only");
  assert.throws(() => buildFishTtsRequest({ model: "s2.1-pro-free", text: "Test", referenceId: "fish-private-C01", licenseScope: "commercial" }), /evaluation-only/);
  const streaming = fs.readFileSync(output);
  streaming.writeUInt32LE(0xffffff00, 4);
  streaming.writeUInt32LE(0xffffff00, 40);
  fs.writeFileSync(output, streaming);
  assert.equal(Math.round(wavDurationSeconds(output)), 8);
  normalizeWavHeader(output);
  assert.equal(fs.readFileSync(output).readUInt32LE(4), fs.statSync(output).size - 8);
  const asset = registerFishMaster(fixture.manifest, fixture.manifestPath, { output, voiceAssetId: "V-C01-FISH", characterId: "C01", model: tts.model, referenceId: tts.payload.reference_id, licenseScope: tts.licenseScope, rights: "synthetic" });
  assert.equal(asset.provider, "fish-audio");
  assert.equal(asset.providerModel, "s2.1-pro-free");
  assert.equal(asset.licenseScope, "evaluation-only");
  approveVoiceAsset(fixture.manifest, fixture.manifestPath, asset.voiceAssetId, "user", "Approved for pilot evaluation only");
  const result = validateManifest(fixture.manifest, fixture.manifestPath);
  assert.equal(result.ok, true, JSON.stringify(result.errors, null, 2));
  assert(result.warnings.some((item) => item.code === "VOICE_EVALUATION_ONLY"));
});

test("post plan assembles succeeded clips to 1920x1080 timeline", () => {
  const fixture = setup("post-plan");
  const job = addValidJob(fixture);
  write(path.join(fixture.root, "out.mp4"), "video");
  job.status = "succeeded";
  job.sequence = 1;
  const plan = buildEditPlan(fixture.manifest, fixture.manifestPath, { outputDir: path.join(fixture.root, "edit") });
  assert.equal(plan.format.width, 1920);
  assert.equal(plan.format.height, 1080);
  assert.equal(plan.episodes[0].clips[0].jobId, job.jobId);
  const preflight = preflightEditPlan(plan, { ffprobe: null, ffmpeg: null });
  assert.equal(preflight.ok, true, JSON.stringify(preflight.errors, null, 2));
  const args = ffmpegArgsForEpisode(plan, plan.episodes[0]);
  assert(args.join(" ").includes("scale=1920:1080"));
  assert(args.includes("+faststart"));
});

let passed = 0;
try {
  for (const { name, fn } of tests) {
    try {
      fn();
      passed += 1;
      console.log(`PASS ${name}`);
    } catch (error) {
      console.error(`FAIL ${name}`);
      console.error(error.stack ?? error.message);
    }
  }
  console.log(`${passed}/${tests.length} tests passed`);
  if (passed !== tests.length) process.exitCode = 1;
} finally {
  const resolvedTemp = path.resolve(tempRoot);
  const resolvedOsTemp = path.resolve(os.tmpdir());
  if (resolvedTemp.startsWith(`${resolvedOsTemp}${path.sep}`) && path.basename(resolvedTemp).startsWith("short-drama-production-selftest-")) {
    fs.rmSync(resolvedTemp, { recursive: true, force: true });
  }
}
