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

/** The only Godot release the probes and showcases compare with: the transpiler follows its source. */
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
 * by their names in the project. Throws when Godot exits with an error.
 * @canonical A scratch Godot project run once, its standard output read
 */
export function runGodotScript(mainScript, files) {
  const { status, stdout, stderr } = runGodotScriptToExit(mainScript, files);
  if (status !== 0) throw new Error(`godot exited with ${status}:\n${stderr}`);
  return stdout;
}

/**
 * The exit status and both outputs of a run of `mainScript`, for a run that may end Godot: Godot
 * prints its crash report on standard output and exits with 134.
 */
export function runGodotScriptToExit(mainScript, files) {
  const directory = mkdtempSync(join(tmpdir(), 'godot-project-'));
  try {
    const project = {
      'project.godot': PROJECT_GODOT,
      'main.tscn': MAIN_SCENE,
      'main.gd': mainScript,
      ...files,
    };
    for (const [name, text] of Object.entries(project)) writeFileSync(join(directory, name), text);
    const first = spawnGodot(directory);
    const result = failedToStart(first) ? spawnGodot(directory) : first;
    if (isTimeout(result)) throw new Error(`run godot: no exit within ${result.timeoutMs} ms`);
    if (result.error) {
      throw new Error(
        `run godot twice: ${result.error.message}. Godot ${GODOT_VERSION} and xvfb-run must be on the path, as in the CI image`
      );
    }
    return { status: result.status, stdout: result.stdout, stderr: result.stderr };
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

function spawnGodot(directory) {
  const plan = godotSpawnPlan(['--path', directory], { display: true });
  const result = spawnSync(plan.command, plan.argv, {
    encoding: 'utf8',
    env: plan.env,
    timeout: plan.timeoutMs,
    maxBuffer: OUTPUT_BYTES_AT_MOST,
  });
  return { ...result, timeoutMs: plan.timeoutMs };
}

const isTimeout = (result) => result.error?.code === 'ETIMEDOUT';

/**
 * Whether a run ended before the project printed anything: Godot or xvfb did not start. One
 * more start is allowed. A probe that ends Godot prints its crash report, and a run that times
 * out has started, so neither is such a run: a second hung run would double the job's wait.
 */
const failedToStart = (result) =>
  !isTimeout(result) && (result.error !== undefined || (result.status !== 0 && result.stdout.trim() === ''));

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
