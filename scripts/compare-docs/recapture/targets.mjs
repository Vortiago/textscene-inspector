/** WHICH images the sheets ask for, where each one lives, and who renders it. */

import { closeSync, existsSync, openSync, readFileSync, readSync } from 'node:fs';
import { join } from 'node:path';
import { CANVAS_2D_CAPTURE } from '../../visual/previewServer.mjs';
import { COMPLEX_SCENES } from '../capture-complex.mjs';
import {
  IMAGES_DIR as IMAGES,
  REPO_ROOT,
  collectSheetFiles,
  findScene,
  parseCompareMarkers,
  parseFrontmatter,
} from '../sheetSources.mjs';
import { readRecordedMode } from '../capture/modes.mjs';

/**
 * Seconds of particle settle from a `particles=` attribute. A typo would
 * otherwise coerce to 0 and render Godot's frame 0 beside our settled pose — a
 * wrong side-by-side that reports itself as a successful capture.
 */
function particleSeconds(raw, file) {
  if (raw === undefined || raw === '') return 0;
  const seconds = Number(raw);
  if (!Number.isFinite(seconds) || seconds < 0) {
    throw new Error(`${file}: particles= needs seconds, got "${raw}"`);
  }
  return seconds;
}

/**
 * Every (image, fixture, camera, particles) the sheets reference — legacy pair
 * + sections.
 */
export function collectTargets() {
  const byImage = new Map();
  for (const file of collectSheetFiles()) {
    const text = readFileSync(file, 'utf8');
    const parsed = parseFrontmatter(text);
    if (!parsed) continue;
    const { meta } = parsed;
    const camera = meta.camera || '';
    const particles = particleSeconds(meta.particles, file);
    // The frontmatter pair and the section markers are BOTH sources, never
    // either/or: a sheet that gains its first section must not lose the image
    // its own header still displays. Taking only the sections silently orphans
    // that image — it stops being re-rendered, drifts from the renderer, and
    // there is no failure to notice, because every OTHER image still updates.
    // Sections are applied last so one may override the header for a shared
    // name; the Map collapses the duplicate.
    if (meta.visual !== 'false' && meta.image && meta.fixture) {
      // A no-visual sheet renders a "draws nothing" note, not its image — skip it.
      byImage.set(meta.image, { fixture: meta.fixture, camera, particles });
    }
    for (const attrs of parseCompareMarkers(parsed.body)) {
      if (attrs.image && attrs.fixture) {
        byImage.set(attrs.image, {
          fixture: attrs.fixture,
          camera,
          particles: attrs.particles === undefined ? particles : particleSeconds(attrs.particles, file),
        });
      }
    }
  }
  return [...byImage.entries()].map(([image, t]) => ({ image, ...t })).sort((a, b) => a.image.localeCompare(b.image));
}

// The Godot-side scene path for a sheet's `fixture` value (which is the ours-side
// `?fixture=` id). Shared with the sheets test so both agree on what resolves.
export const godotScenePath = (fixture) => findScene(fixture) ?? join(REPO_ROOT, 'scenes/fixtures', fixture);
export const imgPath = (image, side) => join(IMAGES, `${image}-${side}.png`);

/**
 * Which workspace an already-rendered reference was captured in.
 *
 * The `.mode` sidecar first, because Godot is the side that classifies the root
 * and it writes the answer down. Measuring the PNG is only a fallback for an
 * image cached from before the sidecar existed, and it is not reliable on its
 * own: a 2D frame is now the scene's own `display/window/size/viewport_*`, so a
 * 640x400 pong capture and a 1920x1080 RTS capture both measure as '3d'. That
 * does not fail, it quietly builds the gallery against the wrong workspace.
 */
export function modeOfExistingGodot(image) {
  const file = imgPath(image, 'godot');
  if (!existsSync(file)) return null;
  const recorded = readRecordedMode(file);
  if (recorded) return recorded;
  const h = Buffer.alloc(24);
  const fd = openSync(file, 'r');
  try {
    readSync(fd, h, 0, 24, 0);
  } finally {
    closeSync(fd);
  }
  return h.readUInt32BE(16) === CANVAS_2D_CAPTURE.width && h.readUInt32BE(20) === CANVAS_2D_CAPTURE.height
    ? '2d'
    : '3d';
}

/**
 * Split sheet images into the ones this script renders and the ones
 * capture-complex.mjs owns.
 *
 * Both scripts write `<image>-godot.png` into the same directory, and a complex
 * scene needs per-scene settings (`frame`, `sceneCamera`, a named `oursCamera`,
 * a forced 2D/3D mode) that live in COMPLEX_SCENES and that a sheet's
 * frontmatter cannot express. Rendering one here with this script's defaults
 * produces a WRONG frame that silently overwrites the right one — the town
 * captured from the editor orbit ends up under the terrain — and nothing fails,
 * because a picture is a picture. So ownership is decided by the slug, in one
 * place, and the owned ones are handed to their owner rather than guessed at.
 */
export function partitionTargets(targets) {
  const complexSlugs = new Set(COMPLEX_SCENES.map((c) => c.slug));
  return {
    own: targets.filter((t) => !complexSlugs.has(t.image)),
    delegated: targets.filter((t) => complexSlugs.has(t.image)),
  };
}
