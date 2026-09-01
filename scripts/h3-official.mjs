#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";
import { validateManifest } from "./production-kit.mjs";

const BASE_URL = "https://api.minimax.io";
const TERMINAL = new Set(["succeeded", "failed", "cancelled"]);
const ROLE_TO_TYPE = {
  reference_image: "image_url",
  first_frame: "image_url",
  last_frame: "image_url",
  reference_video: "video_url",
  reference_audio: "audio_url"
};
const EXTENSION_MIME = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".heic": "image/heic",
  ".heif": "image/heif",
  ".mp4": "video/mp4",
  ".mov": "video/quicktime",
  ".wav": "audio/wav",
  ".mp3": "audio/mpeg"
};
const MAX_BYTES = { image_url: 30 * 1024 * 1024, video_url: 50 * 1024 * 1024, audio_url: 15 * 1024 * 1024 };

function isFilled(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8").replace(/^\uFEFF/, ""));
}

function writeManifest(file, manifest) {
  manifest.project.updatedAt = new Date().toISOString();
  const temporary = `${file}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  fs.renameSync(temporary, file);
}

function resolveStored(manifestPath, stored) {
  return path.isAbsolute(stored) ? path.normalize(stored) : path.resolve(path.dirname(manifestPath), stored);
}

function fileSha256(file) {
  const hash = crypto.createHash("sha256");
  const descriptor = fs.openSync(file, "r");
  const buffer = Buffer.allocUnsafe(1024 * 1024);
  try {
    let bytesRead;
    do {
      bytesRead = fs.readSync(descriptor, buffer, 0, buffer.length, null);
      if (bytesRead) hash.update(buffer.subarray(0, bytesRead));
    } while (bytesRead);
  } finally {
    fs.closeSync(descriptor);
  }
  return hash.digest("hex");
}

function extractPrompt(file) {
  let text = fs.readFileSync(file, "utf8").replace(/^\uFEFF/, "").trim();
  const lines = text.split(/\r?\n/);
  const separators = lines.map((line, index) => line.trim() === "---" ? index : -1).filter((index) => index >= 0);
  if (separators.length) text = lines.slice(separators.at(-1) + 1).join("\n").trim();
  return text;
}

function mediaContent(reference, manifestPath, hashes) {
  const type = ROLE_TO_TYPE[reference.role];
  if (!type) throw new Error(`Unsupported H3 reference role: ${reference.role}`);
  let url = reference.url;
  let bytes = 0;
  let sha256 = null;
  if (!isFilled(url)) {
    if (!isFilled(reference.path)) throw new Error(`${reference.refId ?? reference.role} is missing path or url`);
    const file = resolveStored(manifestPath, reference.path);
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) throw new Error(`Reference file does not exist: ${file}`);
    const extension = path.extname(file).toLowerCase();
    const mime = EXTENSION_MIME[extension];
    if (!mime || !mime.startsWith(type.split("_")[0])) throw new Error(`${reference.refId ?? reference.role} file format does not match ${type}: ${extension}`);
    const raw = fs.readFileSync(file);
    bytes = raw.byteLength;
    if (bytes > MAX_BYTES[type]) throw new Error(`${reference.refId ?? reference.role} exceeds the per-file size limit`);
    sha256 = crypto.createHash("sha256").update(raw).digest("hex");
    if (hashes.has(sha256)) throw new Error(`${reference.refId ?? reference.role} duplicates another local reference file`);
    hashes.add(sha256);
    url = `data:${mime};base64,${raw.toString("base64")}`;
  } else if (!/^https?:\/\//i.test(url)) {
    throw new Error(`${reference.refId ?? reference.role} url must be an HTTP(S) address`);
  }
  return { content: { type, [type]: { url }, role: reference.role }, audit: { refId: reference.refId, role: reference.role, source: sha256 ? "embedded-local" : "public-url", bytes, sha256 } };
}

export function buildH3Request(manifest, manifestPath, jobId) {
  const job = (manifest.jobs ?? []).find((item) => item?.jobId === jobId);
  if (!job) throw new Error(`H3 job not found: ${jobId}`);
  const promptFile = resolveStored(manifestPath, job.promptPath);
  if (!fs.existsSync(promptFile) || !fs.statSync(promptFile).isFile()) throw new Error(`Prompt file does not exist: ${promptFile}`);
  const prompt = extractPrompt(promptFile);
  if (!prompt) throw new Error("H3 prompt is empty");
  if (prompt.length > 7000) throw new Error(`H3 prompt exceeds the official 7,000-character limit: ${prompt.length}`);
  const hashes = new Set();
  const media = (job.references ?? []).map((reference) => mediaContent(reference, manifestPath, hashes));
  const content = [{ type: "text", text: prompt }, ...media.map((item) => item.content)];
  const hasFrameMode = media.some((item) => ["first_frame", "last_frame"].includes(item.content.role));
  const ratio = hasFrameMode ? "adaptive" : (job.ratio ?? manifest.project?.format?.aspectRatio ?? "16:9");
  const payload = {
    model: "MiniMax-H3",
    content,
    resolution: job.resolution ?? manifest.project?.format?.generationResolution ?? "768P",
    duration: job.duration,
    ratio
  };
  if (isFilled(job.callbackUrl)) payload.callback_url = job.callbackUrl;
  const payloadBytes = Buffer.byteLength(JSON.stringify(payload));
  if (payloadBytes > 64 * 1024 * 1024) throw new Error(`H3 request body of ${payloadBytes} bytes exceeds the official 64 MB limit; use a stable public URL instead`);
  return { job, payload, audit: { jobId, promptFile, promptCharacters: prompt.length, payloadBytes, media: media.map((item) => item.audit), ratio, resolution: payload.resolution, duration: payload.duration } };
}

export function preflightH3Job(manifest, manifestPath, jobId) {
  const validation = validateManifest(manifest, manifestPath);
  const targetErrors = validation.errors.filter((item) => item.path === "$" || item.path.startsWith("$.project") || item.path.startsWith("$.policies") || item.path.startsWith("$.voiceAssets") || item.path.startsWith("$.artifacts") || item.path.startsWith("$.jobs"));
  const built = buildH3Request(manifest, manifestPath, jobId);
  return { ok: targetErrors.length === 0, errors: targetErrors, warnings: validation.warnings, audit: built.audit };
}

export function redactedPayload(payload) {
  return {
    ...payload,
    content: payload.content.map((item) => {
      if (item.type === "text") return item;
      const field = item.type;
      const url = item[field]?.url ?? "";
      return { ...item, [field]: { url: url.startsWith("data:") ? "<embedded-local-media>" : url } };
    })
  };
}

function apiKey() {
  let key = String(process.env.MINIMAX_API_KEY ?? "").trim();
  const configured = String(process.env.MINIMAX_API_KEY_FILE ?? "").trim();
  const keyFile = configured ? path.resolve(configured) : path.join(os.homedir(), ".codex", "secrets", "minimax.key");
  if (!key && fs.existsSync(keyFile)) key = fs.readFileSync(keyFile, "utf8").replace(/^\uFEFF/, "").trim();
  if (!key) throw new Error("Missing MINIMAX_API_KEY, MINIMAX_API_KEY_FILE, or ~/.codex/secrets/minimax.key");
  return key;
}

async function requestJson(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 120000);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal, headers: { Authorization: `Bearer ${apiKey()}`, Accept: "application/json", ...(options.headers ?? {}) } });
    const text = await response.text();
    let value;
    try { value = JSON.parse(text); } catch { throw new Error(`MiniMax returned non-JSON: ${text.slice(0, 500)}`); }
    if (!response.ok) throw new Error(`MiniMax HTTP ${response.status}: ${JSON.stringify(value)}`);
    return value;
  } finally {
    clearTimeout(timer);
  }
}

async function queryTask(taskId) {
  const value = await requestJson(`${BASE_URL}/v2/query/video_generation/${encodeURIComponent(taskId)}`);
  if (!value?.task || typeof value.task !== "object") throw new Error("MiniMax query result is missing task");
  return value.task;
}

function syncTask(job, task) {
  job.execution ??= { provider: "minimax-official" };
  job.execution.provider = "minimax-official";
  job.execution.taskId = task.id ?? job.execution.taskId;
  job.execution.updatedAt = new Date().toISOString();
  job.execution.remote = { status: task.status, resolution: task.resolution, duration: task.duration, ratio: task.ratio, usage: task.usage };
  if (["queued", "running"].includes(task.status)) job.status = "running";
  else if (task.status === "succeeded") job.status = "succeeded";
  else if (task.status === "failed") job.status = "failed";
  else if (task.status === "cancelled") job.status = "cancelled";
}

async function downloadVideo(url, output) {
  const response = await fetch(url, { headers: { Accept: "video/mp4,*/*" } });
  if (!response.ok || !response.body) throw new Error(`Video download failed: HTTP ${response.status}`);
  fs.mkdirSync(path.dirname(output), { recursive: true });
  const temporary = `${output}.part`;
  try {
    await pipeline(Readable.fromWeb(response.body), fs.createWriteStream(temporary));
    fs.renameSync(temporary, output);
  } catch (error) {
    if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
    throw error;
  }
}

async function submit(manifest, manifestPath, jobId) {
  const built = buildH3Request(manifest, manifestPath, jobId);
  const job = built.job;
  if (job.status !== "approved" || job.costApproved !== true) throw new Error(`job ${jobId} must first be job-approved and have approved status`);
  const response = await requestJson(`${BASE_URL}/v2/video_generation`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(built.payload) });
  if (!isFilled(response?.task_id)) throw new Error(`MiniMax submission result is missing task_id: ${JSON.stringify(response)}`);
  job.status = "submitted";
  job.attempt = Number(job.attempt ?? 0) + 1;
  job.execution = { provider: "minimax-official", taskId: response.task_id, submittedAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  writeManifest(manifestPath, manifest);
  return { taskId: response.task_id, jobId };
}

async function pollOnce(manifest, manifestPath, jobId) {
  const job = (manifest.jobs ?? []).find((item) => item?.jobId === jobId);
  if (!job?.execution?.taskId) throw new Error(`job ${jobId} has no execution.taskId`);
  const task = await queryTask(job.execution.taskId);
  syncTask(job, task);
  if (task.status === "succeeded" && isFilled(task.content?.url)) {
    const output = resolveStored(manifestPath, job.outputPath);
    await downloadVideo(task.content.url, output);
    job.outputSha256 = fileSha256(output);
    job.execution.downloadedAt = new Date().toISOString();
  }
  writeManifest(manifestPath, manifest);
  return task;
}

function option(args, name, fallback) {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] !== undefined ? args[index + 1] : fallback;
}

function usage() {
  console.log(`MiniMax H3 official production adapter

Usage:
  node scripts/h3-official.mjs preflight <production.json> --id <job>
  node scripts/h3-official.mjs dry-run <production.json> --id <job>
  node scripts/h3-official.mjs submit <production.json> --id <job> --confirm-submit <job>
  node scripts/h3-official.mjs status <production.json> --id <job>
  node scripts/h3-official.mjs wait <production.json> --id <job> [--poll 10] [--timeout 3600]
`);
}

async function main() {
  const [command, target, ...args] = process.argv.slice(2);
  if (!command || ["help", "-h", "--help"].includes(command)) return usage();
  if (!target) throw new Error(`${command} requires production.json`);
  const manifestPath = path.resolve(target);
  const manifest = readJson(manifestPath);
  const jobId = option(args, "--id", "");
  if (!isFilled(jobId)) throw new Error("Missing --id <job>");
  if (command === "preflight") {
    const result = preflightH3Job(manifest, manifestPath, jobId);
    console.log(JSON.stringify(result, null, 2));
    if (!result.ok) process.exitCode = 1;
    return;
  }
  if (command === "dry-run") {
    const built = buildH3Request(manifest, manifestPath, jobId);
    console.log(JSON.stringify({ audit: built.audit, payload: redactedPayload(built.payload) }, null, 2));
    return;
  }
  if (command === "submit") {
    if (option(args, "--confirm-submit", "") !== jobId) throw new Error(`Paid submission requires explicit --confirm-submit ${jobId}`);
    console.log(JSON.stringify(await submit(manifest, manifestPath, jobId), null, 2));
    return;
  }
  if (command === "status") {
    console.log(JSON.stringify(await pollOnce(manifest, manifestPath, jobId), null, 2));
    return;
  }
  if (command === "wait") {
    const poll = Number(option(args, "--poll", "10"));
    const timeout = Number(option(args, "--timeout", "3600"));
    if (!Number.isFinite(poll) || poll < 2 || !Number.isFinite(timeout) || timeout < 1) throw new Error("Invalid poll/timeout parameters");
    const deadline = Date.now() + timeout * 1000;
    while (true) {
      const current = readJson(manifestPath);
      const task = await pollOnce(current, manifestPath, jobId);
      console.log(`${new Date().toISOString()} ${task.status}`);
      if (TERMINAL.has(task.status)) {
        if (task.status !== "succeeded") process.exitCode = 1;
        return;
      }
      if (Date.now() >= deadline) throw new Error(`Timed out waiting for ${jobId}; last status: ${task.status}`);
      await new Promise((resolve) => setTimeout(resolve, poll * 1000));
    }
  }
  usage();
  process.exitCode = 1;
}

const invoked = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (invoked === fileURLToPath(import.meta.url)) main().catch((error) => {
  console.error(`ERROR｜${error.message}`);
  process.exitCode = 1;
});
