/** Which images the sheets ask for, where each one lives, and who renders it. */

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
 * Seconds of particle settle from a `particles=` attribute. It throws on a typo,
 * which would otherwise coerce to 0 and render Godot's frame 0 beside our pose.
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
 * Every (image, fixture, camera, particles) the sheets reference: the legacy
 * pair and the sections. A sheet's `camera:` is looked through on both sides.
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
    // The frontmatter pair and the section markers are both sources, or the
    // header's image stops being re-rendered. Sections apply last, so one may
    // override the header for a shared name.
    if (meta.visual !== 'false' && meta.image && meta.fixture) {
      // A no-visual sheet renders a "draws nothing" note, not its image.
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

// The Godot-side scene path for a sheet's `fixture` value, the ours-side
// `?fixture=` id. Shared with the sheets test so both agree on what resolves.
export const godotScenePath = (fixture) => findScene(fixture) ?? join(REPO_ROOT, 'scenes/fixtures', fixture);
export const imgPath = (image, side) => join(IMAGES, `${image}-${side}.png`);

/**
 * Which workspace a rendered reference was captured in: Godot's `.mode` sidecar
 * first. The PNG size is a fallback for an image with no sidecar, and wrong for
 * a 2D frame of any size but the capture frame's.
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
 * Splits sheet images into the ones this script renders and the ones
 * capture-complex.mjs owns, by slug. A complex scene needs the per-scene
 * settings in COMPLEX_SCENES, and this script's defaults would silently
 * overwrite its frame with a wrong one.
 */
export function partitionTargets(targets) {
  const complexSlugs = new Set(COMPLEX_SCENES.map((c) => c.slug));
  return {
    own: targets.filter((t) => !complexSlugs.has(t.image)),
    delegated: targets.filter((t) => complexSlugs.has(t.image)),
  };
}
