import { execFile } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const READ_SCRIPT = fileURLToPath(new URL('strToVar.gd', import.meta.url));
const run = promisify(execFile);

/** Each `READ:` line of Godot's output, the case name and its reading split by a tab. */
export function readLines(output) {
  const lines = output.split('\n').filter((line) => line.startsWith('READ:'));
  if (lines.length === 0) throw new Error(`expected READ lines from Godot, got:\n${output}`);
  return lines.map((line) => line.slice('READ:'.length));
}

async function main(file) {
  const project = mkdtempSync(join(tmpdir(), 'godot-str-to-var-oracle-'));
  try {
    writeFileSync(join(project, 'project.godot'), 'config_version=5\n');
    const args = ['--headless', '--path', project, '--script', READ_SCRIPT, '--', file];
    const { stdout } = await run('godot', args, { encoding: 'utf8' });
    for (const line of readLines(stdout)) console.log(line);
  } finally {
    rmSync(project, { recursive: true, force: true });
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url))
  await main(resolve(process.argv[2] ?? 'str_to_var.txt'));
