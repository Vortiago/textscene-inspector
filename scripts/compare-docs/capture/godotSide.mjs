/** The reference side: real Godot, one scene at a time. */

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderReference } from '../../godot-ref/run.mjs';
import { IMAGES, REPO_ROOT, imagePath, modePath } from './paths.mjs';
import { readRecordedMode } from './modes.mjs';

export async function captureGodot(fixtures, force) {
  mkdirSync(IMAGES, { recursive: true });
  const failures = [];
  const modes = new Map();
  for (const [i, fixture] of fixtures.entries()) {
    const out = imagePath(fixture, 'godot');
    // The sidecar is half the entry, and it has to be a READABLE half.
    // Without a workspace `resolveModes` refuses the fixture with "capture
    // --godot first" — a remedy that could never run while this pass answered
    // "have it" off a sidecar that merely existed. `readRecordedMode` is the
    // same reader that side uses, so the two agree on what counts as an answer
    // and a recorded `unknown` re-renders instead of sticking.
    if (!force && existsSync(out) && readRecordedMode(out)) {
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
      } else {
        // Written even with no answer, so the miss above does not re-render
        // this scene on every run. `readRecordedMode` reads anything that is
        // not `2d` or `3d` as no answer, which is what this is.
        writeFileSync(modePath(out), 'unknown\n');
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
