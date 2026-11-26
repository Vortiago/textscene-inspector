import { execFile } from 'node:child_process';
import { copyFileSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const LOAD_SCRIPT = fileURLToPath(new URL('load.gd', import.meta.url));
const run = promisify(execFile);

/** The first parse error, else the first error: a missing file prints `Cannot open file` before it. */
export function firstError(output) {
  const lines = output.split('\n');
  const errors = lines
    .filter((line) => line.startsWith('ERROR: '))
    .map((line) => line.slice('ERROR: '.length));
  const error = errors.find((line) => line.includes('Parse Error')) ?? errors[0];
  if (error !== undefined) return error;
  const loaded = lines.find((line) => line.startsWith('LOADED:'))?.slice('LOADED:'.length);
  if (loaded === 'true') return 'loads';
  if (loaded !== undefined && loaded !== 'false') return `loads ${loaded}`;
  throw new Error(`expected an ERROR line or a LOADED line from Godot, got:\n${output}`);
}

async function loadOne(project, name) {
  const args = ['--headless', '--path', project, '--script', LOAD_SCRIPT, '--', `res://${name}`];
  // A refused load still exits 0, so only a crash rejects.
  try {
    const { stdout, stderr } = await run('godot', args, { encoding: 'utf8' });
    return firstError(`${stdout}\n${stderr}`);
  } catch (error) {
    if (error.signal) return `crashes (${error.signal})`;
    throw error;
  }
}

async function main(folder) {
  const project = mkdtempSync(join(tmpdir(), 'godot-load-oracle-'));
  try {
    writeFileSync(join(project, 'project.godot'), 'config_version=5\n');
    const names = readdirSync(folder)
      .filter((name) => /\.(tscn|tres)$/.test(name))
      .sort();
    for (const name of names) copyFileSync(join(folder, name), join(project, name));
    // One load at a time: each run writes the project's `.godot/` folder, which parallel runs share.
    for (const name of names) console.log(`${name}\t${await loadOne(project, name)}`);
  } finally {
    rmSync(project, { recursive: true, force: true });
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main(resolve(process.argv[2] ?? '.'));
