/** Hand the complex slugs to capture-complex.mjs, so one command still refreshes everything. */

import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export async function runComplex(delegated, args) {
  if (!delegated.length) return [];
  const sides = [args.godot ? '--godot' : null, args.ours ? '--ours' : null].filter(Boolean);
  if (!sides.length) return [];
  console.log(`\n[recapture] ${delegated.length} image(s) owned by capture-complex.mjs — delegating`);
  const failures = [];
  for (const t of delegated) {
    const r = spawnSync(
      process.execPath,
      [fileURLToPath(new URL('../capture-complex.mjs', import.meta.url)), ...sides, '--only', t.image],
      { stdio: 'inherit' }
    );
    if (r.status !== 0) failures.push({ image: t.image, error: 'capture-complex.mjs failed' });
  }
  return failures;
}
