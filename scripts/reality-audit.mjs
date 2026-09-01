#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

function usage() {
  console.log('Usage: node scripts/reality-audit.mjs validate <reality-audit.json>');
}

function fail(message) {
  console.error(message);
  process.exitCode = 1;
}

const [command, input] = process.argv.slice(2);
if (["help", "--help", "-h"].includes(command)) {
  usage();
  process.exit(0);
}
if (command !== 'validate' || !input) {
  usage();
  process.exit(2);
}

const file = path.resolve(input);
let data;
try {
  data = JSON.parse(fs.readFileSync(file, 'utf8'));
} catch (error) {
  fail(`Cannot read ${file}: ${error.message}`);
  process.exit();
}

const errors = [];
const requiredString = (value, at) => {
  if (typeof value !== 'string' || !value.trim()) errors.push(`${at} must be a non-empty string`);
};
const requiredList = (value, at, min = 1) => {
  if (!Array.isArray(value) || value.length < min || value.some((item) => typeof item !== 'string' || !item.trim())) {
    errors.push(`${at} requires at least ${min} non-empty strings`);
  }
};

if (data.schemaVersion !== '1.0') errors.push('schemaVersion must be 1.0');
if (data.projectMode !== 'reality-grounded') errors.push('projectMode must be reality-grounded');
requiredString(data.researchedAt, 'researchedAt');

const sources = Array.isArray(data.sources) ? data.sources : [];
if (!sources.length) errors.push('sources requires at least one source');
const sourceIds = new Set();
let authoritative = 0;
for (const [index, source] of sources.entries()) {
  const at = `sources[${index}]`;
  requiredString(source?.id, `${at}.id`);
  requiredString(source?.title, `${at}.title`);
  requiredString(source?.url, `${at}.url`);
  requiredString(source?.accessedAt, `${at}.accessedAt`);
  if (!['authoritative', 'visual'].includes(source?.kind)) errors.push(`${at}.kind must be authoritative or visual`);
  if (source?.kind === 'authoritative') authoritative += 1;
  if (sourceIds.has(source?.id)) errors.push(`${at}.id is duplicated: ${source.id}`);
  sourceIds.add(source?.id);
}
if (!authoritative) errors.push('At least one authoritative source is required');

const scenes = Array.isArray(data.scenes) ? data.scenes : [];
if (!scenes.length) errors.push('scenes requires at least one reality-sensitive scene');
const sceneIds = new Set();
for (const [index, scene] of scenes.entries()) {
  const at = `scenes[${index}]`;
  requiredString(scene?.sceneId, `${at}.sceneId`);
  requiredString(scene?.domain, `${at}.domain`);
  requiredString(scene?.realWorldFunction, `${at}.realWorldFunction`);
  requiredList(scene?.mustHave, `${at}.mustHave`, 3);
  requiredList(scene?.topology, `${at}.topology`, 2);
  requiredList(scene?.confusionsToAvoid, `${at}.confusionsToAvoid`, 2);
  requiredList(scene?.sourceRefs, `${at}.sourceRefs`, 1);
  for (const ref of scene?.sourceRefs ?? []) if (!sourceIds.has(ref)) errors.push(`${at}.sourceRefs references a missing source: ${ref}`);
  requiredString(scene?.flow?.entry, `${at}.flow.entry`);
  requiredString(scene?.flow?.operation, `${at}.flow.operation`);
  requiredString(scene?.flow?.exit, `${at}.flow.exit`);
  requiredString(scene?.flow?.counterflow, `${at}.flow.counterflow`);
  if (scene?.peoplePolicy?.assetSheet !== 'empty') errors.push(`${at}.peoplePolicy.assetSheet must be empty`);
  requiredString(scene?.peoplePolicy?.productionShot, `${at}.peoplePolicy.productionShot`);
  for (const key of ['assetPrompt', 'storyboard', 'frames']) {
    if (!['pending', 'pass', 'fail', 'not-applicable'].includes(scene?.audit?.[key])) {
      errors.push(`${at}.audit.${key} must be pending/pass/fail/not-applicable`);
    }
  }
  if (sceneIds.has(scene?.sceneId)) errors.push(`${at}.sceneId is duplicated: ${scene.sceneId}`);
  sceneIds.add(scene?.sceneId);
}

if (errors.length) {
  console.error(`✗ Reality audit failed (${errors.length} issue(s))`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

const pending = scenes.flatMap((scene) => ['assetPrompt', 'storyboard', 'frames']
  .filter((key) => scene.audit[key] === 'pending')
  .map((key) => `${scene.sceneId}.${key}`));
console.log(`✓ Reality-audit structure passed: ${scenes.length} scene(s), ${sources.length} source(s) (${authoritative} authoritative)`);
if (pending.length) console.log(`⚠ Pending human acceptance: ${pending.join(', ')}`);
