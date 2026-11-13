/**
 * Runs a scratch Godot project once, on lavapipe under xvfb as `pnpm ref:godot` does, and answers
 * its standard output. The probes and the end to end showcases both print their pixels there.
 */

import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { godotSpawnPlan } from '../godot-ref/run.mjs';

/**
 * Godot's standard output for a project of `files`, keyed by their names in the project.
 * @canonical A scratch Godot project run once, its standard output read
 */
export function runGodotProject(files) {
  const directory = mkdtempSync(join(tmpdir(), 'godot-project-'));
  try {
    for (const [name, text] of Object.entries(files)) writeFileSync(join(directory, name), text);
    const plan = godotSpawnPlan(['--path', directory], { display: true });
    const result = spawnSync(plan.command, plan.argv, {
      encoding: 'utf8',
      env: plan.env,
      timeout: plan.timeoutMs,
    });
    if (result.error) throw new Error(`run godot: ${result.error.message}`);
    if (result.status !== 0) throw new Error(`godot exited with ${result.status}:\n${result.stderr}`);
    return result.stdout;
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}
