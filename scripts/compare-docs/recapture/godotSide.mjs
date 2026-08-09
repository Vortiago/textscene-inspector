/** The reference side: real Godot, one sheet image at a time. */

import { mkdirSync, writeFileSync } from 'node:fs';
import { renderReference } from '../../godot-ref/run.mjs';
import { IMAGES_DIR as IMAGES } from '../sheetSources.mjs';
import { modePath } from '../capture/paths.mjs';
import { godotScenePath, imgPath } from './targets.mjs';

export async function captureGodot(targets) {
  mkdirSync(IMAGES, { recursive: true });
  const modes = new Map();
  const failures = [];
  for (const [i, t] of targets.entries()) {
    process.stdout.write(`[godot] ${i + 1}/${targets.length} ${t.image} … `);
    try {
      const { mode } = await renderReference({
        scene: godotScenePath(t.fixture),
        out: imgPath(t.image, 'godot'),
        sceneCamera: Boolean(t.camera),
      });
      if (mode) {
        modes.set(t.image, mode);
        // Beside the image, like the batch capture does: a later `--ours`-only
        // run reads this rather than re-measuring the PNG, whose size no longer
        // identifies the workspace.
        writeFileSync(modePath(imgPath(t.image, 'godot')), `${mode}\n`);
      }
      console.log(`ok (${mode ?? '?'})`);
    } catch (error) {
      console.log(`FAILED: ${error.message.split('\n')[0]}`);
      failures.push({ image: t.image, error: error.message.split('\n')[0] });
    }
  }
  return { modes, failures };
}
