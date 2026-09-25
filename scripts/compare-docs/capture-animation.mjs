#!/usr/bin/env node
/**
 * Captures an animated node on both sides as `<image>-godot.gif` and `-ours.gif`:
 *   node scripts/compare-docs/capture-animation.mjs unit-animation-player.tscn
 * Both sides sample one clip at the same 24 times. The previewer selects the
 * player first, since selection mounts its transport (ADR-0012).
 */

import { existsSync, readFileSync } from 'node:fs';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { CROP_2D } from './animation/clip.mjs';
import { cropFrames, encodeGif } from './animation/gif.mjs';
import { captureGodotFrames } from './animation/godotFrames.mjs';
import { IMAGES, REPO_ROOT } from './animation/paths.mjs';
import { captureOurFrames } from './animation/previewFrames.mjs';

async function main() {
  const fixture = process.argv[2];
  if (!fixture) {
    console.error('Usage: node scripts/compare-docs/capture-animation.mjs <fixture.tscn>');
    process.exit(2);
  }
  // An AnimatedSprite2D means a 2D scene in the project viewport, cropped so the
  // GIF stays small. Otherwise an AnimationPlayer drives a 3D scene seen from the
  // editor camera under the editor preview environment.
  const scenePath = resolve(REPO_ROOT, 'scenes/fixtures', fixture);
  const source = existsSync(scenePath) ? readFileSync(scenePath, 'utf8') : '';
  const spriteMatch = source.match(/\[node name="([^"]+)"\s+type="AnimatedSprite2D"/);
  const mode = spriteMatch ? '2d' : '3d';
  const driverText = spriteMatch ? spriteMatch[1] : 'AnimationPlayer';

  const image = fixture.replace(/\.tscn$/, '');
  const scratch = await mkdtemp(join(tmpdir(), 'anim-frames-'));
  await mkdir(IMAGES, { recursive: true });
  try {
    console.log(`[anim] ${fixture} (${mode}): capturing Godot frames…`);
    await captureGodotFrames(fixture, join(scratch, 'godot'), mode);
    console.log(`[anim] ${fixture}: capturing our frames…`);
    await captureOurFrames(fixture, join(scratch, 'ours'), mode, driverText);
    if (mode === '2d') {
      await cropFrames(join(scratch, 'godot'), CROP_2D);
      await cropFrames(join(scratch, 'ours'), CROP_2D);
    }
    await encodeGif(join(scratch, 'godot'), join(IMAGES, `${image}-godot.gif`));
    await encodeGif(join(scratch, 'ours'), join(IMAGES, `${image}-ours.gif`));
    console.log(`[anim] wrote ${image}-godot.gif and ${image}-ours.gif to ${IMAGES}`);
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
}

await main();
