#!/usr/bin/env node
/**
 * Re-render EVERY comparison image the sheets reference — one command to refresh
 * the whole gallery after a renderer change, so no sheet is left showing a stale
 * frame. The sheets are the source of truth: each sheet's `image:`/`fixture:` and
 * each section's `<!-- compare: image= fixture= -->` marker names an image and the
 * scene that produces it.
 *
 *   pnpm recapture              # re-render godot + ours for every sheet image
 *   pnpm recapture --ours       # only ours (Godot is deterministic; this is the
 *                               # usual case — our renderer is what drifts)
 *   pnpm recapture --only sky   # limit to images whose name contains "sky"
 *
 * Godot detects 2D vs 3D from the scene, so both sides frame the same way with no
 * per-image config; a sheet's `camera:` (a scene Camera3D path) is looked through
 * on both sides when present.
 */
import { chromium } from 'playwright';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  existsSync,
  mkdirSync,
  openSync,
  readSync,
  closeSync,
  readFileSync,
} from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { SWIFTSHADER_GL_ARGS } from '../showcase/browser.mjs';
import { renderReference } from '../godot-ref/run.mjs';
import {
  assertPortFree,
  createCaptureContext,
  ensureWebBuilt,
  findCaptureTarget,
  gotoFixture,
  killPreviewGroup,
  readViewportMode,
  settleCanvas,
  startPreview,
  waitForServer,
  warmUpGLContext,
  writeCaptureImage,
  CANVAS_2D_CAPTURE,
} from '../visual/previewServer.mjs';
import { COMPLEX_SCENES } from './capture-complex.mjs';
import {
  IMAGES_DIR as IMAGES,
  REPO_ROOT,
  collectSheetFiles,
  findScene,
  parseCompareMarkers,
  parseFrontmatter,
} from './sheetSources.mjs';
const PORT = Number(process.env.COMPARE_PORT) || 4321;

function parseArgs(argv) {
  const a = { godot: true, ours: true, only: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--ours') a.godot = false;
    else if (argv[i] === '--godot') a.ours = false;
    else if (argv[i] === '--only') a.only = argv[++i];
  }
  return a;
}

/**
 * Seconds of particle settle from a `particles=` attribute. A typo would
 * otherwise coerce to 0 and render Godot's frame 0 beside our settled pose —
 * a wrong side-by-side that reports itself as a successful capture.
 */
function particleSeconds(raw, file) {
  if (raw === undefined || raw === '') return 0;
  const seconds = Number(raw);
  if (!Number.isFinite(seconds) || seconds < 0) {
    throw new Error(`${relative(REPO_ROOT, file)}: particles= needs seconds, got "${raw}"`);
  }
  return seconds;
}

/**
 * Every (image, fixture, camera, particles) the sheets reference — legacy pair
 * + sections.
 *
 * Exported for the pure test coverage in collectTargets.test.mjs: this is one
 * side of a bootstrap cycle with build-gallery.mjs — a sheet with no `image:`
 * produces no target here, so a freshly scaffolded slice cannot be recaptured,
 * while build-gallery treats a DECLARED image with no captured file as a
 * broken reference and fails the build that `captureOurs` (below) needs in
 * order to produce that very file.
 */
export function collectTargets() {
  const byImage = new Map();
  for (const file of collectSheetFiles()) {
    const text = readFileSync(file, 'utf8');
    const parsed = parseFrontmatter(text);
    if (!parsed) continue;
    const { meta } = parsed;
    const camera = meta.camera || '';
    // Seconds of particle settle the Godot side must be advanced by, so a
    // section whose subject is an emitter with no `preprocess` shows the same
    // instant on both sides instead of our substituted pose beside Godot's
    // frame 0. Per section, because the instant belongs to the picture.
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
const godotScenePath = (fixture) => findScene(fixture) ?? join(REPO_ROOT, 'scenes/fixtures', fixture);
const imgPath = (image, side) => join(IMAGES, `${image}-${side}.png`);

function modeOfExistingGodot(image) {
  const file = imgPath(image, 'godot');
  if (!existsSync(file)) return null;
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

async function captureGodot(targets) {
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
        particles: t.particles,
      });
      if (mode) modes.set(t.image, mode);
      console.log(`ok (${mode ?? '?'})`);
    } catch (error) {
      console.log(`FAILED: ${error.message.split('\n')[0]}`);
      failures.push({ image: t.image, error: error.message.split('\n')[0] });
    }
  }
  return { modes, failures };
}

async function captureOurs(targets, godotModes) {
  const failures = [];
  const withMode = targets
    .map((t) => ({ ...t, mode: godotModes.get(t.image) ?? modeOfExistingGodot(t.image) }))
    .filter((t) => {
      if (!t.mode) failures.push({ image: t.image, error: 'no godot render to take 2D/3D mode from — run without --ours first' });
      return t.mode;
    });
  if (!withMode.length) return failures;

  ensureWebBuilt();
  await assertPortFree(PORT, 'COMPARE_PORT');
  const { proc, baseUrl } = startPreview(PORT);
  let browser;
  try {
    await waitForServer(`${baseUrl}/`);
    browser = await chromium.launch({ headless: true, args: SWIFTSHADER_GL_ARGS });
    // Burn the first-WebGL-context-lost risk before any published image is
    // captured — see warmUpGLContext's own doc comment.
    await warmUpGLContext(browser);
    let done = 0;
    for (const mode of ['3d', '2d']) {
      const group = withMode.filter((t) => t.mode === mode);
      if (!group.length) continue;
      const context = await createCaptureContext(browser, { frameOnOpen: false, canvas2D: mode === '2d' });
      const page = await context.newPage();
      try {
        for (const t of group) {
          process.stdout.write(`[ours] ${++done}/${withMode.length} ${t.image} (${mode}) … `);
          try {
            await gotoFixture(page, baseUrl, t.fixture, () => {}, t.camera ? { camera: t.camera } : {});
            const { target, reason } = await findCaptureTarget(page, { canvas2D: mode === '2d' });
            if (!target) throw new Error(reason);
            const { buffer, reason: settleReason } = await settleCanvas(page, target);
            if (!buffer) throw new Error(settleReason);
            const opened = await readViewportMode(page);
            if (opened !== mode) {
              throw new Error(`previewer opened ${opened.toUpperCase()} but Godot rendered ${mode.toUpperCase()}`);
            }
            writeCaptureImage(imgPath(t.image, 'ours'), buffer, `${t.image} ours`);
            console.log('ok');
          } catch (error) {
            console.log(`FAILED: ${error.message}`);
            failures.push({ image: t.image, error: error.message });
          }
        }
      } finally {
        await context.close();
      }
    }
  } finally {
    await browser?.close();
    killPreviewGroup(proc);
  }
  return failures;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  let targets = collectTargets();
  if (args.only) targets = targets.filter((t) => t.image.includes(args.only));
  const { own, delegated } = partitionTargets(targets);
  if (!targets.length) throw new Error(args.only ? `No sheet image matches --only ${args.only}` : 'No sheet images found');
  console.log(`Re-rendering ${own.length} comparison image(s)…`);

  const godot = args.godot ? await captureGodot(own) : { modes: new Map(), failures: [] };
  const oursFailures = args.ours ? await captureOurs(own, godot.modes) : [];
  const delegatedFailures = await runComplex(delegated, args);

  const failures = [...godot.failures, ...oursFailures, ...delegatedFailures];
  console.log(`\n[recapture] images in ${IMAGES}`);
  if (failures.length) {
    console.warn(`\n${failures.length} failure(s):`);
    for (const f of failures) console.warn(`  - ${f.image}: ${f.error}`);
    process.exitCode = 1;
  }
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

/** Hand the complex slugs to capture-complex.mjs, so one command still refreshes everything. */
async function runComplex(delegated, args) {
  if (!delegated.length) return [];
  const sides = [args.godot ? '--godot' : null, args.ours ? '--ours' : null].filter(Boolean);
  if (!sides.length) return [];
  console.log(`\n[recapture] ${delegated.length} image(s) owned by capture-complex.mjs — delegating`);
  const failures = [];
  for (const t of delegated) {
    const r = spawnSync(
      process.execPath,
      [fileURLToPath(new URL('./capture-complex.mjs', import.meta.url)), ...sides, '--only', t.image],
      { stdio: 'inherit' }
    );
    if (r.status !== 0) failures.push({ image: t.image, error: 'capture-complex.mjs failed' });
  }
  return failures;
}

// Guarded: this module exports partitionTargets for the ownership test, and an
// unguarded main() would start rendering the moment anything imported it.
if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
