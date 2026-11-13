/**
 * Runs a scratch Godot project once, on lavapipe under xvfb as `pnpm ref:godot` does, and answers
 * its standard output. The probes and the end to end showcases both print their pixels there, from
 * a main script that this module puts in a project of one scene.
 */

import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { godotSpawnPlan } from '../godot-ref/run.mjs';

/** The only Godot release the probes and showcases compare with: the translator follows its source. */
const GODOT_VERSION = '4.6.3';

/**
 * The most output a run may print. Node's default of 1 MiB stops a run that reads the verdict on
 * twenty thousand shaders, each refusal about 600 bytes of standard error.
 */
const OUTPUT_BYTES_AT_MOST = 256 * 1024 * 1024;

/** Frames a main script draws before it reads its viewports: the first frames compile the pipelines. */
export const FRAMES_BEFORE_READ = 4;

const PROJECT_GODOT = `config_version=5

[application]
run/main_scene="res://main.tscn"

[display]
window/size/viewport_width=64
window/size/viewport_height=64
`;

const MAIN_SCENE = `[gd_scene load_steps=2 format=3]

[ext_resource type="Script" path="res://main.gd" id="1"]

[node name="Main" type="Node"]
script = ExtResource("1")
`;

/**
 * Godot's standard output for a project whose one scene runs `mainScript`, beside `files` keyed
 * by their names in the project.
 * @canonical A scratch Godot project run once, its standard output read
 */
export function runGodotScript(mainScript, files) {
  const directory = mkdtempSync(join(tmpdir(), 'godot-project-'));
  try {
    const project = {
      'project.godot': PROJECT_GODOT,
      'main.tscn': MAIN_SCENE,
      'main.gd': mainScript,
      ...files,
    };
    for (const [name, text] of Object.entries(project)) writeFileSync(join(directory, name), text);
    const plan = godotSpawnPlan(['--path', directory], { display: true });
    const result = spawnSync(plan.command, plan.argv, {
      encoding: 'utf8',
      env: plan.env,
      timeout: plan.timeoutMs,
      maxBuffer: OUTPUT_BYTES_AT_MOST,
    });
    if (result.error) throw new Error(`run godot: ${result.error.message}`);
    if (result.status !== 0) throw new Error(`godot exited with ${result.status}:\n${result.stderr}`);
    return result.stdout;
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

/** The text after the first `prefix` line of Godot's `stdout`. Throws when Godot printed none. */
export function printedField(stdout, prefix) {
  const line = stdout.split('\n').find((text) => text.startsWith(prefix));
  if (!line) throw new Error(`expected a "${prefix}" line in Godot's output, found none`);
  return line.slice(prefix.length).trim();
}

/** The RGBA8 bytes of each `<prefix><name> <hex>` line of Godot's `stdout`, keyed by name. */
export function printedImages(stdout, prefix) {
  const images = new Map();
  for (const line of stdout.split('\n').filter((text) => text.startsWith(prefix))) {
    const [name, hex = ''] = line.slice(prefix.length).trim().split(' ');
    images.set(name, Uint8Array.from(Buffer.from(hex, 'hex')));
  }
  return images;
}

/** Refuses an answer from any Godot but the pinned release. */
export function requireGodotVersion(version) {
  if (!version.startsWith(`${GODOT_VERSION}-stable`)) {
    throw new Error(`expected Godot ${GODOT_VERSION}, got ${version}`);
  }
}
