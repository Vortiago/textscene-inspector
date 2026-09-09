#!/usr/bin/env node
/**
 * Capture an animated node on both sides as a GIF, for the comparison sheets —
 * the still-image counterpart is `capture.mjs`, but a node whose whole point is
 * motion (AnimationPlayer, and anything it drives) needs to be seen moving.
 *
 *   node scripts/compare-docs/capture-animation.mjs unit-animation-player.tscn
 *
 * Both sides render the SAME clip at the SAME set of times from the editor
 * camera, so frame i is the same moment in each: real Godot seeks its
 * AnimationPlayer and saves a PNG per frame (`animation/godotFrames.mjs`); the
 * previewer selects the player (which is what mounts its transport, ADR-0012),
 * drives the scrubber to each time, and screenshots
 * (`animation/previewFrames.mjs`). The two PNG sequences are encoded to
 * `<image>-godot.gif` and `<image>-ours.gif` beside the stills.
 *
 * Two modes, chosen by the fixture: a 3D scene driven by an AnimationPlayer is
 * framed with the 3D editor camera and lit by Godot's editor preview
 * environment; a 2D scene driven by an AnimatedSprite2D renders into the project
 * viewport (no camera, no preview sun — 2D lighting is the scene's own, exactly
 * like the still 2D capture) and is cropped to a viewport-centred window so the
 * GIF stays small. Both sample the SAME clip loop at the SAME 24 times.
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
  // The driver decides the mode: an AnimatedSprite2D means a 2D scene (rendered
  // into the project viewport), otherwise an AnimationPlayer-driven 3D scene.
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
