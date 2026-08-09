/** The reference side: real Godot, one scene at a time. */

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderReference } from '../../godot-ref/run.mjs';
import { IMAGES, REPO_ROOT, imagePath, modePath } from './paths.mjs';

export async function captureGodot(fixtures, force) {
  mkdirSync(IMAGES, { recursive: true });
  const failures = [];
  const modes = new Map();
  for (const [i, fixture] of fixtures.entries()) {
    const out = imagePath(fixture, 'godot');
    if (!force && existsSync(out)) {
      console.log(`[godot] ${i + 1}/${fixtures.length} ${fixture} — have it`);
      continue;
    }
    process.stdout.write(`[godot] ${i + 1}/${fixtures.length} ${fixture} … `);
    try {
      const { mode } = await renderReference({
        scene: join(REPO_ROOT, 'scenes/fixtures', fixture),
        out,
      });
      if (mode) {
        modes.set(fixture, mode);
        // Beside the image, so a later run that reuses the cache still knows
        // which workspace it is — the image's own size no longer says.
        writeFileSync(modePath(out), `${mode}\n`);
      }
      console.log(`ok (${mode ?? 'mode unknown'})`);
    } catch (error) {
      // One unrenderable scene must not cost the other sixty.
      console.log(`FAILED: ${error.message.split('\n')[0]}`);
      failures.push({ fixture, error: error.message.split('\n')[0] });
    }
  }
  return { failures, modes };
}
