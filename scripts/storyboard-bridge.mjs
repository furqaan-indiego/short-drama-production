#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SIZE_MAP = {
  EWS: "extreme-wide",
  WS: "wide",
  MWS: "wide",
  MS: "medium",
  MCU: "medium",
  TWO_SHOT: "medium",
  OTS: "medium",
  CU: "close",
  INSERT: "close",
  POV: "close",
  ECU: "extreme-close"
};

const SIZE_PHRASES = {
  "extreme-wide": "extreme wide shot",
  wide: "wide shot",
  medium: "medium shot",
  close: "close-up",
  "extreme-close": "extreme close-up"
};

const CAMERA_MAP = {
  static: "Static Shot",
  push: "Push In",
  pull: "Pull Out",
  track: "Tracking Shot",
  arc: "Arc Shot",
  handheld: "Shake Slightly",
  crane: "Pedestal Up",
  roll: "Roll Clockwise"
};

function arrayOf(value) {
  return Array.isArray(value) ? value : [];
}

function isFilled(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8").replace(/^\uFEFF/, ""));
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function normalizeText(value) {
  return String(value ?? "").replace(/\s+/g, "").replace(/[。！？!?，,；;：:]/g, "");
}

function scriptBeatText(beat) {
  return typeof beat?.line === "string" ? beat.line : beat?.action;
}

function cameraTerm(shot) {
  const move = shot?.camera?.move;
  if (CAMERA_MAP[move]) return CAMERA_MAP[move];
  if (move === "pan" || move === "whip_pan") return shot?.screenDirection === "right-to-left" ? "Pan Left" : "Pan Right";
  if (move === "truck") return shot?.screenDirection === "right-to-left" ? "Truck Left" : "Truck Right";
  if (move === "tilt") return /下|down/i.test(shot?.camera?.path ?? "") ? "Tilt Down" : "Tilt Up";
  if (move === "pedestal") return /下|down/i.test(shot?.camera?.path ?? "") ? "Pedestal Down" : "Pedestal Up";
  return "Static Shot";
}

function sceneCharacters(scriptScene, directorScene, shot) {
  const byBeat = new Map(arrayOf(directorScene?.sourceBeats).map((beat) => [beat.beatId, beat]));
  const speakers = arrayOf(shot?.dialogueRefs)
    .map((id) => byBeat.get(id)?.speaker)
    .filter(isFilled);
  const explicit = arrayOf(shot?.characters).filter(isFilled);
  const allowed = new Set(arrayOf(scriptScene?.characters));
  return [...new Set([...explicit, ...speakers])].filter((id) => allowed.size === 0 || allowed.has(id));
}

function relativeStored(fromFile, absolute) {
  const relative = path.relative(path.dirname(fromFile), absolute).replace(/\\/g, "/");
  return relative || ".";
}

function rebaseReferences(references, directorPath, storyboardPath) {
  return arrayOf(references).map((reference) => {
    if (!isFilled(reference?.path)) return structuredClone(reference);
    const absolute = path.isAbsolute(reference.path) ? path.normalize(reference.path) : path.resolve(path.dirname(directorPath), reference.path);
    return { ...structuredClone(reference), path: relativeStored(storyboardPath, absolute) };
  });
}

function findScriptEpisode(script, epNumber) {
  return arrayOf(script?.episodes).find((episode) => episode?.ep === epNumber);
}

function findScriptScene(scriptEpisode, directorScene, sceneIndex) {
  const scenes = arrayOf(scriptEpisode?.scenes);
  if (isFilled(directorScene?.sourceSceneId)) {
    const byId = scenes.find((scene) => scene?.sceneId === directorScene.sourceSceneId);
    if (byId) return { scene: byId, sceneIndex: scenes.indexOf(byId) + 1 };
  }
  return { scene: scenes[sceneIndex], sceneIndex: sceneIndex + 1 };
}

function beatIndexMap(directorScene, scriptScene, errors, at) {
  const sourceBeats = arrayOf(directorScene?.sourceBeats);
  const flow = arrayOf(scriptScene?.flow);
  const map = new Map();
  if (sourceBeats.length !== flow.length) errors.push(`${at}: director sourceBeats (${sourceBeats.length} beats) does not match script flow (${flow.length} beats)`);
  sourceBeats.forEach((beat, index) => {
    map.set(beat.beatId, index + 1);
    const scriptText = scriptBeatText(flow[index]);
    if (flow[index] && normalizeText(beat.text) !== normalizeText(scriptText)) errors.push(`${at}: ${beat.beatId} text does not match script beat ${index + 1}`);
  });
  return map;
}

function shotBeatRange(shot, indexByBeat, errors, at) {
  const indexes = arrayOf(shot?.beatRefs).map((id) => indexByBeat.get(id)).filter(Number.isInteger);
  if (indexes.length !== arrayOf(shot?.beatRefs).length) errors.push(`${at}: contains beatRefs that cannot map back to script flow`);
  if (indexes.length === 0) return [0, 0];
  const sorted = [...indexes].sort((a, b) => a - b);
  for (let i = 1; i < sorted.length; i += 1) if (sorted[i] !== sorted[i - 1] + 1) errors.push(`${at}: beatRefs are not contiguous script beats; split technically and record a deviation`);
  return [sorted[0], sorted[sorted.length - 1]];
}

export function bridgeDirectorPackage(director, script, options = {}) {
  const errors = [];
  const warnings = [];
  const aspectRatio = options.aspectRatio ?? "16:9";
  const directorAspect = director?.format?.aspectRatio;
  if (directorAspect !== aspectRatio) errors.push(`Director-package aspect ratio ${directorAspect ?? "missing"} does not match project aspect ratio ${aspectRatio}`);
  const episodes = [];

  for (const directorEpisode of arrayOf(director?.episodes)) {
    const scriptEpisode = findScriptEpisode(script, directorEpisode.ep);
    if (!scriptEpisode) {
      errors.push(`Director-package episode ${directorEpisode.ep} does not exist in script.json`);
      continue;
    }
    const segments = [];
    let sequence = 0;
    arrayOf(directorEpisode.scenes).forEach((directorScene, directorSceneIndex) => {
      const located = findScriptScene(scriptEpisode, directorScene, directorSceneIndex);
      if (!located.scene) {
        errors.push(`E${String(directorEpisode.ep).padStart(2, "0")} scene ${directorScene.sceneId ?? directorSceneIndex + 1} cannot map to a script scene`);
        return;
      }
      const at = `E${String(directorEpisode.ep).padStart(2, "0")}/${directorScene.sceneId}`;
      const indexByBeat = beatIndexMap(directorScene, located.scene, errors, at);

      for (const clip of arrayOf(directorScene.clips)) {
        sequence += 1;
        const segmentId = `E${String(directorEpisode.ep).padStart(2, "0")}-${String(sequence).padStart(2, "0")}`;
        const cuts = arrayOf(clip.shots).map((shot, shotIndex) => {
          const shotAt = `${at}/${shot.shotId ?? `SH${shotIndex + 1}`}`;
          const size = SIZE_MAP[shot.size] ?? "medium";
          if (!SIZE_MAP[shot.size]) warnings.push(`${shotAt}: unknown director shot size ${shot.size}; bridged as medium`);
          const frame = String(shot.framePrompt ?? "").trim();
          if (!frame.toLowerCase().includes(SIZE_PHRASES[size])) warnings.push(`${shotAt}: framePrompt still needs the English shot-size phrase ${SIZE_PHRASES[size]}`);
          if (shot.duration > 5) warnings.push(`${shotAt}: director shot duration of ${shot.duration}s exceeds the usual 2–5s attention rhythm; preserve directorial intent and do not silently fragment it`);
          return {
            beats: shotBeatRange(shot, indexByBeat, errors, shotAt),
            seconds: shot.duration,
            size,
            camera: cameraTerm(shot),
            angle: shot.angle,
            lensMm: shot.lensMm,
            cameraPlan: structuredClone(shot.camera),
            screenDirection: shot.screenDirection,
            axisAction: shot.axisAction,
            blocking: shot.blocking,
            transition: shot.transition,
            characters: sceneCharacters(located.scene, directorScene, shot),
            props: arrayOf(shot.props),
            frame,
            sourceShotId: shot.shotId,
            dramaticPurpose: shot.dramaticPurpose,
            directorIntent: {
              originalSize: shot.size,
              angle: shot.angle,
              lensMm: shot.lensMm,
              camera: structuredClone(shot.camera),
              composition: shot.composition,
              blocking: shot.blocking,
              eyeline: shot.eyeline,
              screenDirection: shot.screenDirection,
              axisAction: shot.axisAction,
              transition: shot.transition
            },
            note: ""
          };
        });
        segments.push({
          id: segmentId,
          sceneIndex: located.sceneIndex,
          sourceSceneId: directorScene.sceneId,
          sourceClipId: clip.clipId,
          generationMode: director?.format?.generation?.mode ?? "model-agnostic",
          referenceMode: clip.referenceMode,
          references: options.directorPath && options.storyboardPath ? rebaseReferences(clip.references, options.directorPath, options.storyboardPath) : structuredClone(arrayOf(clip.references)),
          speakerBindings: structuredClone(arrayOf(clip.speakerBindings)),
          dramaticFunction: clip.dramaticFunction,
          audioPlan: clip.audioPlan,
          cuts,
          h3Prompt: clip.modelPrompt ?? "",
          promptPath: `h3/${segmentId}/prompt.md`,
          deviations: []
        });
      }
    });
    episodes.push({ ep: directorEpisode.ep, segments });
  }

  const board = {
    schemaVersion: "1.1-director-bridge",
    source: director?.title ?? script?.source ?? "",
    style: options.style ?? "realistic",
    promptLang: options.promptLang ?? "en",
    aspectRatio,
    compositionProfile: aspectRatio === "16:9" ? "landscape-ensemble" : "portrait-subject-priority",
    params: { maxSegmentSeconds: 15, minCutSeconds: 1, maxCutSeconds: 15, maxOnScreen: aspectRatio === "16:9" ? 4 : 3, tolerance: 0.15 },
    handoff: {
      sourceDirector: options.directorPath ?? director?.source ?? "director-package.json",
      sourceScript: options.scriptPath ?? "script.json",
      policy: "director-authoritative",
      warnings
    },
    episodes
  };
  return { board, errors, warnings };
}

function expectedShots(director, script) {
  const expected = new Map();
  const errors = [];
  for (const directorEpisode of arrayOf(director?.episodes)) {
    const scriptEpisode = findScriptEpisode(script, directorEpisode.ep);
    arrayOf(directorEpisode.scenes).forEach((directorScene, sceneIndex) => {
      const located = findScriptScene(scriptEpisode, directorScene, sceneIndex);
      const indexes = beatIndexMap(directorScene, located.scene, errors, directorScene.sceneId ?? `scene-${sceneIndex + 1}`);
      for (const clip of arrayOf(directorScene.clips)) for (const shot of arrayOf(clip.shots)) expected.set(shot.shotId, { shot, clip, range: shotBeatRange(shot, indexes, errors, shot.shotId) });
    });
  }
  return { expected, errors };
}

export function validateBridge(board, director, script, options = {}) {
  const errors = [];
  const warnings = [];
  const aspectRatio = options.aspectRatio ?? board?.aspectRatio ?? "16:9";
  if (board?.aspectRatio !== aspectRatio) errors.push(`Storyboard aspect ratio ${board?.aspectRatio ?? "missing"} does not match project ${aspectRatio}`);
  if (director?.format?.aspectRatio !== aspectRatio) errors.push(`Director aspect ratio ${director?.format?.aspectRatio ?? "missing"} does not match project ${aspectRatio}`);
  if (aspectRatio === "16:9" && board?.compositionProfile !== "landscape-ensemble") errors.push("A 16:9 storyboard must use the landscape-ensemble composition profile");

  const source = expectedShots(director, script);
  errors.push(...source.errors);
  const actual = new Map();
  function approvedDeviation(segment, shotId, field) {
    return arrayOf(segment?.deviations).some((deviation) => deviation?.sourceShotId === shotId && deviation?.status === "approved" && isFilled(deviation?.approvedBy) && arrayOf(deviation?.fields).includes(field));
  }
  function changed(mapped, shotId, field, message) {
    if (approvedDeviation(mapped.segment, shotId, field)) warnings.push(`${shotId} has an approved technical deviation for ${field}`);
    else errors.push(message);
  }
  for (const episode of arrayOf(board?.episodes)) for (const segment of arrayOf(episode?.segments)) {
    const duration = arrayOf(segment.cuts).reduce((sum, cut) => sum + Number(cut?.seconds ?? 0), 0);
    const sourceClip = [...source.expected.values()].find((item) => item.clip.clipId === segment.sourceClipId)?.clip;
    if (!sourceClip) errors.push(`${segment.id} is missing a valid sourceClipId`);
    else if (Math.abs(duration - sourceClip.duration) > 0.001) errors.push(`${segment.id} technical-storyboard duration ${duration}s does not match director segment ${sourceClip.duration}s`);
    for (const deviation of arrayOf(segment.deviations)) {
      if (!source.expected.has(deviation?.sourceShotId)) errors.push(`${segment.id} deviation references unknown sourceShotId ${deviation?.sourceShotId ?? ""}`);
      for (const key of ["reason", "original", "change", "dramaticImpact", "status"]) if (!isFilled(deviation?.[key])) errors.push(`${segment.id} deviation ${deviation?.deviationId ?? "unnumbered"} is missing ${key}`);
      if (!Array.isArray(deviation?.fields) || deviation.fields.length === 0) errors.push(`${segment.id} deviation ${deviation?.deviationId ?? "unnumbered"} must list fields`);
      if (deviation?.status === "approved" && !isFilled(deviation?.approvedBy)) errors.push(`${segment.id} approved deviation ${deviation?.deviationId ?? "unnumbered"} is missing approvedBy`);
    }
    for (const cut of arrayOf(segment.cuts)) {
      if (!isFilled(cut?.sourceShotId)) {
        errors.push(`${segment.id} contains a technical shot missing sourceShotId`);
        continue;
      }
      if (actual.has(cut.sourceShotId)) errors.push(`${cut.sourceShotId} is covered redundantly by multiple technical shots`);
      actual.set(cut.sourceShotId, { cut, segment });
    }
  }

  for (const [shotId, item] of source.expected) {
    const mapped = actual.get(shotId);
    if (!mapped) {
      errors.push(`Director shot ${shotId} is not covered by the technical storyboard`);
      continue;
    }
    const cut = mapped.cut;
    if (JSON.stringify(cut.beats) !== JSON.stringify(item.range)) errors.push(`${shotId} script-beat coverage changed`);
    if (cut.dramaticPurpose !== item.shot.dramaticPurpose) errors.push(`${shotId} dramaticPurpose was rewritten`);
    if (cut.directorIntent?.originalSize !== item.shot.size || cut.directorIntent?.angle !== item.shot.angle || cut.directorIntent?.lensMm !== item.shot.lensMm || JSON.stringify(cut.directorIntent?.camera) !== JSON.stringify(item.shot.camera)) errors.push(`${shotId} directorIntent snapshot was tampered with`);
    if (cut.size !== SIZE_MAP[item.shot.size]) changed(mapped, shotId, "size", `${shotId} technical shot size has an unapproved deviation`);
    if (cut.angle !== item.shot.angle) changed(mapped, shotId, "angle", `${shotId} angle has an unapproved deviation`);
    if (cut.lensMm !== item.shot.lensMm) changed(mapped, shotId, "lensMm", `${shotId} focal length has an unapproved deviation`);
    if (cut.screenDirection !== item.shot.screenDirection) changed(mapped, shotId, "screenDirection", `${shotId} screen direction has an unapproved deviation`);
    if (cut.axisAction !== item.shot.axisAction) changed(mapped, shotId, "axisAction", `${shotId} axis strategy has an unapproved deviation`);
    if (JSON.stringify(cut.cameraPlan) !== JSON.stringify(item.shot.camera)) changed(mapped, shotId, "camera", `${shotId} camera plan has an unapproved deviation`);
  }
  for (const shotId of actual.keys()) if (!source.expected.has(shotId)) errors.push(`Technical storyboard references unknown director shot ${shotId}`);
  return { ok: errors.length === 0, errors, warnings, stats: { directorShots: source.expected.size, mappedShots: actual.size, segments: arrayOf(board?.episodes).reduce((sum, ep) => sum + arrayOf(ep?.segments).length, 0) } };
}

export function writeBridgePack(board, storyboardPath) {
  writeJson(storyboardPath, board);
  for (const episode of arrayOf(board.episodes)) for (const segment of arrayOf(episode.segments)) {
    const promptPath = path.resolve(path.dirname(storyboardPath), segment.promptPath);
    fs.mkdirSync(path.dirname(promptPath), { recursive: true });
    fs.writeFileSync(promptPath, `${String(segment.h3Prompt ?? "").trim()}\n`, "utf8");
  }
}

function option(args, name, fallback) {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] !== undefined ? args[index + 1] : fallback;
}

function usage() {
  console.log(`director → storyboard bridge

Usage:
  node scripts/storyboard-bridge.mjs build <director-package.json> --script <script.json> --out <storyboard.json> [--aspect 16:9] [--force]
  node scripts/storyboard-bridge.mjs validate <storyboard.json> --director <director-package.json> --script <script.json> [--aspect 16:9]
`);
}

function main() {
  const [command, target, ...args] = process.argv.slice(2);
  if (!command || ["help", "-h", "--help"].includes(command)) return usage();
  if (!target) throw new Error(`${command} requires an input path`);
  if (command === "build") {
    const directorPath = path.resolve(target);
    const scriptPath = path.resolve(option(args, "--script", ""));
    const storyboardPath = path.resolve(option(args, "--out", "storyboard.json"));
    if (!fs.existsSync(scriptPath)) throw new Error("Missing a valid --script");
    if (fs.existsSync(storyboardPath) && !args.includes("--force")) throw new Error(`Output already exists; use --force to overwrite: ${storyboardPath}`);
    const result = bridgeDirectorPackage(readJson(directorPath), readJson(scriptPath), { aspectRatio: option(args, "--aspect", "16:9"), directorPath, scriptPath, storyboardPath });
    if (result.errors.length) throw new Error(result.errors.join("\n"));
    writeBridgePack(result.board, storyboardPath);
    console.log(JSON.stringify({ storyboard: storyboardPath, segments: result.board.episodes.reduce((sum, ep) => sum + ep.segments.length, 0), warnings: result.warnings }, null, 2));
    return;
  }
  if (command === "validate") {
    const directorPath = path.resolve(option(args, "--director", ""));
    const scriptPath = path.resolve(option(args, "--script", ""));
    if (!fs.existsSync(directorPath) || !fs.existsSync(scriptPath)) throw new Error("validate requires valid --director and --script");
    const result = validateBridge(readJson(path.resolve(target)), readJson(directorPath), readJson(scriptPath), { aspectRatio: option(args, "--aspect", "16:9") });
    console.log(JSON.stringify(result, null, 2));
    if (!result.ok) process.exitCode = 1;
    return;
  }
  usage();
  process.exitCode = 1;
}

const invoked = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (invoked === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    console.error(`ERROR｜${error.message}`);
    process.exitCode = 1;
  }
}
