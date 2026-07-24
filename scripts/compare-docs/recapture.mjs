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
import {
  existsSync,
  mkdirSync,
  openSync,
  readSync,
  closeSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
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
  CANVAS_2D_CAPTURE,
} from '../visual/previewServer.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(here, '../..');
const SHEETS = join(REPO_ROOT, 'docs/comparison/sheets');
const IMAGES = join(REPO_ROOT, 'docs/comparison/images');
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

/** Every (image, fixture, camera) the sheets reference — legacy pair + sections. */
function collectTargets() {
  const byImage = new Map();
  for (const file of readdirSync(SHEETS).filter((f) => f.endsWith('.md'))) {
    const text = readFileSync(join(SHEETS, file), 'utf8');
    const fm = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(text);
    if (!fm) continue;
    const meta = {};
    for (const line of fm[1].split('\n')) {
      const kv = /^(\w+):\s*(.*)$/.exec(line.trim());
      if (kv) meta[kv[1]] = kv[2].replace(/\s*#.*$/, '').trim();
    }
    const camera = meta.camera || '';
    const markers = [...fm[2].matchAll(/<!--\s*compare:\s*(.*?)\s*-->/g)];
    if (markers.length) {
      for (const m of markers) {
        const attrs = Object.fromEntries(m[1].split(/\s+/).map((kv) => kv.split('=')));
        if (attrs.image && attrs.fixture) byImage.set(attrs.image, { fixture: attrs.fixture, camera });
      }
    } else if (meta.visual !== 'false' && meta.image && meta.fixture) {
      // A no-visual sheet renders a "draws nothing" note, not its image — skip it.
      byImage.set(meta.image, { fixture: meta.fixture, camera });
    }
  }
  return [...byImage.entries()].map(([image, t]) => ({ image, ...t })).sort((a, b) => a.image.localeCompare(b.image));
}

// Lazy index of every .tscn under scenes/ by basename, so a bare fixture name
// that is NOT in scenes/fixtures/ (a vendored corpus scene like dungeon.tscn)
// still resolves to its real Godot path.
let sceneIndex = null;
function sceneByBasename(basename) {
  if (!sceneIndex) {
    sceneIndex = new Map();
    const walk = (dir) => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        const p = join(dir, e.name);
        if (e.isDirectory()) walk(p);
        else if (e.name.endsWith('.tscn') && !sceneIndex.has(e.name)) sceneIndex.set(e.name, p);
      }
    };
    walk(join(REPO_ROOT, 'scenes'));
  }
  return sceneIndex.get(basename);
}

// The Godot-side scene path for a sheet's `fixture` value (which is the ours-side
// `?fixture=` id). A path (demos/…) is under scenes/; a bare name is a fixture
// unless it is a corpus scene found elsewhere in the tree.
function godotScenePath(fixture) {
  if (fixture.includes('/')) return join(REPO_ROOT, 'scenes', fixture);
  const inFixtures = join(REPO_ROOT, 'scenes/fixtures', fixture);
  return existsSync(inFixtures) ? inFixtures : sceneByBasename(fixture) ?? inFixtures;
}
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
            writeFileSync(imgPath(t.image, 'ours'), buffer);
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
  if (!targets.length) throw new Error(args.only ? `No sheet image matches --only ${args.only}` : 'No sheet images found');
  console.log(`Re-rendering ${targets.length} comparison image(s)…`);

  const godot = args.godot ? await captureGodot(targets) : { modes: new Map(), failures: [] };
  const oursFailures = args.ours ? await captureOurs(targets, godot.modes) : [];

  const failures = [...godot.failures, ...oursFailures];
  console.log(`\n[recapture] images in ${IMAGES}`);
  if (failures.length) {
    console.warn(`\n${failures.length} failure(s):`);
    for (const f of failures) console.warn(`  - ${f.image}: ${f.error}`);
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
