/**
 * Runs a scratch Godot project once, on lavapipe under xvfb as `pnpm ref:godot` does, and answers
 * its standard output. The probes and the end to end showcases both print their pixels there, from
 * a main script that this module puts in a project of one scene.
 */

import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { availableParallelism, tmpdir } from 'node:os';
import { join } from 'node:path';
import { mapPool } from '../compare-docs/godotLinks/pool.mjs';
import { godotSpawnPlan } from '../godot-ref/run.mjs';

/** The only Godot release the probes and showcases compare with: the transpiler follows its source. */
const GODOT_VERSION = '4.6.3';

/**
 * The most output a run may print on each stream: a run that reads the verdict on twenty thousand
 * shaders prints about 600 characters of standard error for each refusal.
 */
const OUTPUT_CHARACTERS_AT_MOST = 256 * 1024 * 1024;

/**
 * Godot runs at once. A run compiles its shaders on one core, so the probe step takes a quarter of
 * the time on the 4 cores of the CI runner: 8 s against 29 s for 1,822 probes.
 */
const RUNS_AT_ONCE = availableParallelism();

/**
 * The display each run starts its search for a free one at: runs at once start apart, so two of
 * them never race for one display. Written only by `spawnGodot`, and it wraps after 64 runs.
 */
let runsStarted = 0;
const FIRST_SERVER = 100;
const SERVERS_APART = 8;
const SERVER_SLOTS = 64;

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
export async function runGodotScript(mainScript, files) {
  const { status, stdout, stderr } = await runGodotScriptToExit(mainScript, files);
  if (status !== 0) throw new Error(`godot exited with ${status}:\n${stderr}`);
  return stdout;
}

/**
 * The exit status and both outputs of a run of `mainScript`, for a run that may end Godot: Godot
 * prints its crash report on standard output and exits with 134.
 */
export async function runGodotScriptToExit(mainScript, files) {
  const directory = writeProject({ 'main.gd': mainScript, ...files });
  try {
    const first = await spawnGodot(directory);
    const result = failedToStart(first) ? await spawnGodot(directory) : first;
    if (result.error?.code === 'ENOENT') {
      throw new Error(
        `run godot: ${result.error.message}. Godot ${GODOT_VERSION} and xvfb-run must be on the path, as in the CI image`
      );
    }
    if (result.error) throw new Error(`run godot: ${result.error.message}`);
    return { status: result.status, stdout: result.stdout, stderr: result.stderr };
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

/** A scratch project directory of one scene with `files` beside it. The caller removes it. */
function writeProject(files) {
  const directory = mkdtempSync(join(tmpdir(), 'godot-project-'));
  const project = { 'project.godot': PROJECT_GODOT, 'main.tscn': MAIN_SCENE, ...files };
  for (const [name, text] of Object.entries(project)) writeFileSync(join(directory, name), text);
  return directory;
}

/**
 * One run of Godot on `directory`: its exit status and both outputs, or the `error` of a run
 * that did not start, did not exit in time or printed more than a run may.
 */
function spawnGodot(directory) {
  const firstServer = FIRST_SERVER + (runsStarted++ % SERVER_SLOTS) * SERVERS_APART;
  const plan = godotSpawnPlan(['--path', directory], { display: true, firstServer });
  return new Promise((resolve) => {
    // Its own process group, so a stop reaches `xvfb-run`, Godot and Xvfb, not only `timeout`.
    const child = spawn(plan.command, plan.argv, { env: plan.env, detached: true });
    const output = { stdout: '', stderr: '' };
    let error;
    const stop = (reason) => {
      error ??= reason;
      killGroup(child);
    };
    const timer = setTimeout(() => stop(new Error(`no exit within ${plan.timeoutMs} ms`)), plan.timeoutMs);
    for (const stream of ['stdout', 'stderr']) {
      child[stream].setEncoding('utf8');
      child[stream].on('data', (text) => {
        output[stream] += text;
        if (output[stream].length > OUTPUT_CHARACTERS_AT_MOST)
          stop(new Error(`more than ${OUTPUT_CHARACTERS_AT_MOST} characters on ${stream}`));
      });
    }
    child.on('error', (spawnError) => {
      error ??= spawnError;
    });
    child.on('close', (status) => {
      clearTimeout(timer);
      resolve({ ...output, status, error });
    });
  });
}

/** SIGKILL to `child`'s whole process group. A group that has already exited needs none. */
function killGroup(child) {
  try {
    process.kill(-child.pid, 'SIGKILL');
  } catch (error) {
    if (error.code !== 'ESRCH')
      throw new Error(`kill the group of godot run ${child.pid}: ${error.message}`, { cause: error });
  }
}

/**
 * `items` in at most as many contiguous chunks as Godot runs at once, each chunk run by `run`,
 * and each chunk's answer in the order of the chunks. No items make one empty chunk, so the
 * caller still reads Godot's version.
 * @canonical Items run in chunks, one Godot run for each chunk at once
 */
export function inChunksAtOnce(items, run) {
  const size = Math.max(1, Math.ceil(items.length / RUNS_AT_ONCE));
  const count = Math.max(1, Math.ceil(items.length / size));
  const chunks = Array.from({ length: count }, (_, index) => items.slice(index * size, (index + 1) * size));
  return Promise.all(chunks.map(run));
}

/**
 * `run` of each of `items`, with at most as many runs at once as Godot runs at once.
 * @canonical Items run one Godot run each, as many at once as Godot runs at once
 */
export const eachAtOnce = (items, run) => mapPool(items, RUNS_AT_ONCE, (item) => run(item));

/**
 * The first of `runs`, when every run names the same Godot, and the same adapter where a run
 * names one. Answers from two engines would mix otherwise.
 * @canonical The one Godot and adapter of several Godot runs
 */
export function oneGodot(runs) {
  const [first] = runs;
  const other = runs.find((run) => run.godot !== first.godot || run.adapter !== first.adapter);
  if (other) {
    throw new Error(
      `expected one Godot, got ${first.godot} on ${first.adapter ?? 'any adapter'} and ${other.godot} on ${other.adapter ?? 'any adapter'}`
    );
  }
  return first;
}

/** The spawn errors of a Godot or xvfb that did not start, which one more start may clear. */
const START_ERRORS = new Set(['ENOENT', 'EAGAIN']);

/**
 * Whether a run ended before the project printed anything: Godot or xvfb did not start. One
 * more start is allowed. A probe that ends Godot prints its crash report, and a run that times
 * out or overflows its output has started, so neither is such a run.
 */
const failedToStart = (result) =>
  result.error === undefined
    ? result.status !== 0 && result.stdout.trim() === ''
    : START_ERRORS.has(result.error.code);

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
