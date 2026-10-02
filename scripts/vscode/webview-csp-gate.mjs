#!/usr/bin/env node
/**
 * End-to-end gate (`pnpm test:vscode:csp`): a lit 3D mesh draws in its material's
 * colour, Control text and a worker-built noise texture paint inside the real VS Code
 * webview, under the production CSP, with nothing fetched, an ArrayMesh edited on disk
 * redraws through the real file watcher, host and loader, and a text glTF draws its
 * external buffer and texture. `TEXTSCENE_VSCODE_VERSION` picks the VS Code build, as
 * in the extension's own suites. Linux/Xvfb only: see the CI notes in
 * `.github/workflows/ci.yml`.
 */
import { spawnSync } from 'node:child_process';
import { copyFileSync, cpSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { assertExtensionBuilt, driveScene, REPO_ROOT, resolveVscodeBinary } from './driveScene.mjs';
import { blankSceneText, hideSceneNode } from './sceneText.mjs';
import { withSurfaceAlbedo } from './meshEdit.mjs';
import { diffMask, meanColourUnderMask, missingPlaceholderPixels } from './pixels.mjs';
import { installTextureWorkProbe } from '../e2e/textureWorkProbe.mjs';
import { TEXTURE_WORK_STATUS_TESTID } from '../visual/preview/appContract.mjs';

/**
 * The Control fixture whose only ink is text. The preview CSP (`webviewHtml.ts`)
 * is `default-src 'none'` with no `connect-src` or `font-src`, so glyphs come
 * from a vendored MSDF atlas riding `img-src … data:`, not a font library that
 * fetches a font (ADR-0037).
 */
const FIXTURE = 'scenes/fixtures/unit-label-2d.tscn';

/**
 * Ink floor for the label scene, far below a passing run: the count scales with
 * the virtual display. A 640x480 Xvfb screen, shared with the source editor,
 * gives a 235x357 canvas and 252 ink pixels. A blocked glyph atlas takes the
 * count to zero on any display.
 */
const INK_FLOOR = 100;

/**
 * Runs inside the with-text frame: a blob-URL worker must start and answer under
 * the preview CSP (ADR-0042), since procedural textures build in one.
 */
const BLOB_WORKER_PROBE = path.join(REPO_ROOT, 'scripts/vscode/probes/blobWorkerProbe.mjs');

/**
 * The 256x256 noise golden's scene. Its texture builds as a job in the preview's own
 * blob-URL worker, and the scene has no other ink.
 */
const NOISE_FIXTURE = 'scenes/fixtures/unit-noisetexture2d.tscn';

/**
 * Ink floor for the noise scene. Before its texture lands the scene draws nothing, as
 * the text-free label scene reads zero, so any floor above zero shows the texture drew.
 * This one stays far below the sprite's share of even the smallest canvas.
 */
const NOISE_INK_FLOOR = 1000;

/** Reads back, in the noise frame, the workers and replies `installTextureWorkProbe` counted. */
const TEXTURE_WORK_READOUT = path.join(REPO_ROOT, 'scripts/vscode/probes/textureWorkReadout.mjs');

/**
 * The **Dependency hot-reload** scene: one ArrayMesh quad from its own `.tres`. The run
 * recolours the quad on disk while the preview is open, so only the watcher, the host
 * and `provideFile` can bring the new colour to the canvas.
 */
const HOT_RELOAD_FIXTURE = 'scenes/fixtures/unit-arraymesh.tscn';
const HOT_RELOAD_MESH = 'scenes/fixtures/unit-arraymesh-quad.tres';
const HOT_RELOAD_ALBEDO = 'Color(0.9, 0.2, 0.1, 1)';

/**
 * A text glTF with an external `.bin` and an external texture, from the truck town demo.
 * The webview's CSP refuses every fetch, so both must arrive through the provider. Kept
 * at its `res://town/lamp/` path, which the scene names.
 */
const GLTF_EXTERNAL_DIR = 'scenes/demos/3d/truck_town/town/lamp';
const GLTF_EXTERNAL_SCENE = 'lamp_scene.tscn';

/**
 * A box with an orange `StandardMaterial3D` (albedo 0.8, 0.6, 0.2) in the default
 * environment, so it draws only if the mesh, the material, the lights and the camera
 * all work. Its twin hides the box, and the pixels the two do not share are the box.
 */
const BOX_FIXTURE = 'scenes/fixtures/unit-box-mesh.tscn';
const BOX_NODE = 'Box';

/**
 * Pixel floor for the box, far below its share of the smallest canvas the gate has
 * measured. A box that never drew leaves the scene and its twin identical.
 */
const BOX_PIXEL_FLOOR = 2000;

/**
 * Ceiling on the box's mean blue over its mean red. The albedo's own ratio is 0.25,
 * and a material that lost its colour draws grey or white near 1, so the midpoint
 * tells the two apart under any light the default environment gives.
 */
const BOX_BLUE_TO_RED_CEILING = 0.5;

const OUT_ROOT = path.join(REPO_ROOT, 'scripts/vscode/output/csp-gate');
const BASE_PORT = 9464;

function parseArgs(argv) {
  const opts = { skipBuild: false, verbose: false, headed: false };
  for (const arg of argv) {
    switch (arg) {
      case '--skip-build':
        opts.skipBuild = true;
        break;
      case '--verbose':
        opts.verbose = true;
        break;
      case '--headed':
        opts.headed = true;
        break;
      default:
        throw new Error(`Unknown option: ${arg}`);
    }
  }
  return opts;
}

/**
 * Lays out the throwaway workspace the runs open: the label fixture verbatim, its
 * text-free twin, the noise fixture, the ArrayMesh scene with its `.tres`, and the
 * box with its box-free twin, side by side so all resolve `res://` against the same
 * folder. The mesh's edit is built
 * here and written by the hot-reload run.
 */
function prepareScenes() {
  const workspace = path.join(OUT_ROOT, 'workspace');
  rmSync(workspace, { recursive: true, force: true });
  mkdirSync(workspace, { recursive: true });

  const source = path.join(REPO_ROOT, FIXTURE);
  const withText = path.join(workspace, path.basename(source));
  copyFileSync(source, withText);

  const { source: blanked, replacements } = blankSceneText(readFileSync(source, 'utf8'));
  if (replacements === 0) {
    throw new Error(
      `${FIXTURE} carries no \`text = "…"\` assignment, so the text-free twin is ` +
        'identical to it and proves nothing. Point the gate at a scene whose only ink is text.'
    );
  }
  const withoutText = path.join(workspace, 'blanked.tscn');
  writeFileSync(withoutText, blanked);

  const noise = path.join(workspace, path.basename(NOISE_FIXTURE));
  copyFileSync(path.join(REPO_ROOT, NOISE_FIXTURE), noise);

  const hotReload = path.join(workspace, path.basename(HOT_RELOAD_FIXTURE));
  copyFileSync(path.join(REPO_ROOT, HOT_RELOAD_FIXTURE), hotReload);
  const mesh = path.join(workspace, path.basename(HOT_RELOAD_MESH));
  const meshSource = readFileSync(path.join(REPO_ROOT, HOT_RELOAD_MESH), 'utf8');
  writeFileSync(mesh, meshSource);
  const meshEdit = { file: mesh, contents: withSurfaceAlbedo(meshSource, HOT_RELOAD_ALBEDO) };

  const boxSource = readFileSync(path.join(REPO_ROOT, BOX_FIXTURE), 'utf8');
  const box = path.join(workspace, path.basename(BOX_FIXTURE));
  writeFileSync(box, boxSource);
  const boxHidden = path.join(workspace, 'box-hidden.tscn');
  writeFileSync(boxHidden, hideSceneNode(boxSource, BOX_NODE));

  const lampDir = path.join(workspace, 'town', 'lamp');
  cpSync(path.join(REPO_ROOT, GLTF_EXTERNAL_DIR), lampDir, { recursive: true });
  const gltfExternal = path.join(lampDir, GLTF_EXTERNAL_SCENE);

  return {
    workspace,
    withText,
    withoutText,
    noise,
    hotReload,
    meshEdit,
    box,
    boxHidden,
    gltfExternal,
    replacements,
  };
}

class GateFailures {
  constructor() {
    this.failures = [];
  }

  check(condition, message) {
    if (!condition) this.failures.push(message);
  }

  get ok() {
    return this.failures.length === 0;
  }
}

/**
 * A blocked `data:` image quotes the whole base64 payload back in its violation
 * message, several hundred kilobytes of it, which buries every other failure.
 */
function brief(value, limit = 200) {
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  return text.length > limit ? `${text.slice(0, limit)}… (+${text.length - limit} chars)` : text;
}

/** Assertions every run must satisfy, whatever the scene paints. */
function checkRun(gate, label, report) {
  const where = `[${label}]`;

  // Separated from the ink assertions on purpose: a failed WebGL context also
  // reads back zero ink, and "GL never came up" must not look like "no glyphs".
  gate.check(report.openedVia, `${where} the preview command never opened a panel`);
  gate.check(
    report.sizedCanvas === true,
    `${where} the webview never produced a sized canvas — WebGL context creation failed, ` +
      'so the readback below says nothing about text'
  );
  gate.check(
    report.canvasStable === true,
    `${where} the canvas never settled: two consecutive readbacks were still different`
  );
  gate.check(
    !report.canvasReadback?.error,
    `${where} canvas readback failed: ${report.canvasReadback?.error}`
  );

  const webview = report.webview;
  gate.check(
    webview.cspViolations.length === 0,
    `${where} ${webview.cspViolations.length} CSP violation(s) inside the preview: ` +
      webview.cspViolations
        .slice(0, 3)
        .map((entry) => brief(entry.text ?? entry))
        .join(' | ')
  );
  gate.check(
    webview.failedRequests.length === 0,
    `${where} ${webview.failedRequests.length} failed request(s) from the preview: ` +
      webview.failedRequests
        .slice(0, 3)
        .map((entry) => brief(`${entry.failure} ${entry.url}`))
        .join(' | ')
  );
  gate.check(
    webview.consoleErrors.length === 0,
    `${where} ${webview.consoleErrors.length} console error(s) from the preview: ` +
      webview.consoleErrors
        .slice(0, 3)
        .map((entry) => brief(entry.text))
        .join(' | ')
  );
  gate.check(
    webview.offendingHosts.length === 0,
    `${where} the preview talked to ${webview.offendingHosts.join(', ')} — it must load ` +
      "everything from VS Code's local resource origin and the bundle itself"
  );
}

/**
 * The edited mesh redrew in place: the canvas changed after the edit, settled, and
 * equals, pixel for pixel, a cold render of the edited scene.
 */
function checkHotReload(gate, hotReload, fresh) {
  const edit = hotReload.edit;
  gate.check(
    edit?.changed === true,
    '[hot-reload] the canvas never changed after the mesh was edited on disk'
  );
  gate.check(edit?.stable === true, '[hot-reload] the canvas never settled after the edit');
  if (!edit?.canvasPath || !hotReload.canvasPath || !fresh.canvasPath) {
    gate.check(false, '[hot-reload] no before, edited or fresh canvas to compare');
    return;
  }
  const freshPng = readFileSync(fresh.canvasPath);
  let diff;
  let before;
  try {
    diff = diffMask(readFileSync(edit.canvasPath), freshPng, 0);
    before = diffMask(readFileSync(hotReload.canvasPath), freshPng, 0);
  } catch (error) {
    gate.check(false, `[hot-reload] ${error.message}`);
    return;
  }
  // A mesh that never drew leaves the first canvas and the cold render of the
  // recoloured edit identical, which the comparison below would pass.
  gate.check(
    before.diffPixels > 0,
    '[hot-reload] the canvas before the edit equals the cold render of the recoloured mesh, so the mesh never drew'
  );
  gate.check(
    diff.diffPixels === 0,
    `[hot-reload] the hot-reloaded canvas differs from a cold render of the edit in ${diff.diffPixels} ` +
      `pixel(s), within ${JSON.stringify(diff.bbox)}`
  );
}

/**
 * The box drew, in its material's colour: the pixels its box-free twin does not
 * share are many enough to be the box, and their mean is orange, not grey.
 */
function checkBox(gate, box, hidden) {
  if (!box.canvasPath || !hidden.canvasPath) {
    gate.check(false, '[box] no canvas from the box or its box-free twin to compare');
    return null;
  }
  const boxPng = readFileSync(box.canvasPath);
  let diff;
  try {
    diff = diffMask(boxPng, readFileSync(hidden.canvasPath));
  } catch (error) {
    gate.check(false, `[box] ${error.message}`);
    return null;
  }
  gate.check(
    diff.diffPixels >= BOX_PIXEL_FLOOR,
    `[box] only ${diff.diffPixels} pixel(s) differ from the box-free twin, floor is ` +
      `${BOX_PIXEL_FLOOR}: the box did not draw`
  );
  const colour = meanColourUnderMask(boxPng, diff.mask);
  const blueToRed = colour ? colour.b / Math.max(colour.r, 1) : null;
  gate.check(
    blueToRed !== null && blueToRed <= BOX_BLUE_TO_RED_CEILING,
    `[box] the box's mean colour is ${JSON.stringify(colour)}, blue over red ${blueToRed}, ` +
      `ceiling ${BOX_BLUE_TO_RED_CEILING}: the box did not draw in its orange material`
  );
  return { diffPixels: diff.diffPixels, colour, blueToRed };
}

/**
 * The text glTF loaded: its buffer and texture arrived with no fetch, which `checkRun`'s
 * CSP and console checks prove, and no missing-resource placeholder drew in its place.
 */
function checkGltfExternal(gate, report) {
  if (!report.canvasPath) {
    gate.check(false, '[gltf-external] no canvas to read');
    return;
  }
  const placeholder = missingPlaceholderPixels(readFileSync(report.canvasPath));
  gate.check(
    placeholder === 0,
    `[gltf-external] ${placeholder} missing-placeholder pixel(s): the glTF or its buffer never loaded`
  );
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));

  // The gate rebuilds `apps/textscene-vscode/dist/`, so it must not run beside
  // `pnpm validate` or another build of that package. `--skip-build` runs it
  // against a bundle you already trust, and `--verbose` streams VS Code's output.
  if (!opts.skipBuild) {
    console.log('[gate] building the extension…');
    const build = spawnSync('pnpm', ['--filter', 'textscene-inspector', 'build'], {
      cwd: REPO_ROOT,
      stdio: 'inherit',
    });
    if (build.status !== 0) throw new Error('Extension build failed');
  }
  assertExtensionBuilt();

  const binary = await resolveVscodeBinary();
  const bundle = path.join(REPO_ROOT, 'apps/textscene-vscode/dist/webview/webview.js');
  // A build between the two runs gives them different code, which the pair
  // cannot survive, so the bundle's mtime must stay unchanged.
  const bundleStamp = statSync(bundle).mtimeMs;
  const {
    workspace,
    withText,
    withoutText,
    noise,
    hotReload,
    meshEdit,
    box,
    boxHidden,
    gltfExternal,
    replacements,
  } = prepareScenes();
  console.log(`[gate] VS Code:   ${binary}`);
  console.log(`[gate] workspace: ${workspace}`);
  console.log(`[gate] control:   blanked ${replacements} text assignment(s)`);

  // One launch each. The label fixture must paint at least INK_FLOOR ink pixels,
  // and its text-free twin exactly zero. They differ only in whether a glyph is
  // asked for, so an empty canvas fails the first and a canvas that paints
  // chrome or a background fails the second. The noise run must draw a texture
  // that one of the preview's own blob-URL workers built.
  const runs = [
    { label: 'with-text', scene: withText, evalFile: BLOB_WORKER_PROBE },
    { label: 'without-text', scene: withoutText },
    {
      label: 'noise',
      scene: noise,
      evalFile: TEXTURE_WORK_READOUT,
      initScripts: [[installTextureWorkProbe, TEXTURE_WORK_STATUS_TESTID]],
    },
    // The edit run recolours the mesh on disk mid-run. The fresh run, after it, opens
    // the edited scene cold. The two canvases must match exactly: the edit changes no
    // bounds, so the camera fit agrees, and a reload that drew anything else differs.
    { label: 'hot-reload', scene: hotReload, edit: meshEdit },
    { label: 'hot-reload-fresh', scene: hotReload },
    { label: 'box', scene: box },
    { label: 'box-hidden', scene: boxHidden },
    { label: 'gltf-external', scene: gltfExternal },
  ];

  const reports = {};
  for (const [index, run] of runs.entries()) {
    console.log(`\n[gate] driving ${run.label}: ${path.basename(run.scene)}`);
    reports[run.label] = await driveScene({
      scene: run.scene,
      workspace,
      outDir: path.join(OUT_ROOT, run.label),
      binary,
      port: BASE_PORT + index,
      // The canvas settles on a signal (two identical readbacks), so no fixed
      // wait. The CLI's layout palette commands are skipped: each is a fuzzy
      // match that could invoke something else, and readback ink does not depend
      // on the editor width.
      settle: 0,
      preserveBuffer: true,
      prepareLayout: false,
      split: true,
      // Widening the editor area by settings rather than by palette commands:
      // the profile is throwaway, so this lands before the first paint and
      // costs no keystrokes. A wider canvas rasterises the labels larger,
      // which keeps the ink count clear of its floor.
      settings: {
        'workbench.secondarySideBar.defaultVisibility': 'hidden',
        'workbench.activityBar.location': 'hidden',
        'workbench.statusBar.visible': false,
      },
      // Kept for failure triage: CI uploads them.
      screenshots: true,
      headed: opts.headed,
      keepOpen: 0,
      evalFile: run.evalFile,
      initScripts: run.initScripts,
      edit: run.edit,
      verbose: opts.verbose,
      log: (message) => console.log(`[gate:${run.label}] ${message}`),
    });
  }

  const gate = new GateFailures();
  gate.check(
    statSync(bundle).mtimeMs === bundleStamp,
    'the webview bundle was rebuilt while the gate was running — the two scenes were ' +
      'captured from different code, so their difference is not attributable to text. ' +
      'Something else built this package concurrently (pnpm validate?); re-run alone.'
  );
  for (const run of runs) checkRun(gate, run.label, reports[run.label]);

  const workerProbe = reports['with-text'].evalResult;
  gate.check(
    workerProbe?.ok === true,
    `[with-text] a blob-URL worker did not answer inside the preview: ${brief(workerProbe)}`
  );

  const withInk = reports['with-text'].canvasReadback;
  const withoutInk = reports['without-text'].canvasReadback;

  gate.check(
    withInk.inkPixels >= INK_FLOOR,
    `[with-text] only ${withInk.inkPixels} ink pixels on a ${withInk.width}x${withInk.height} ` +
      `canvas, floor is ${INK_FLOOR} — the glyph atlas did not paint`
  );
  gate.check(
    withoutInk.inkPixels === 0,
    `[without-text] ${withoutInk.inkPixels} ink pixels with every label emptied — the ink ` +
      'counted for the text scene is not attributable to text'
  );

  // The in-thread fallback draws the same pixels, so only the reply shows the worker ran.
  const noiseReport = reports.noise;
  const textureWork = noiseReport.evalResult;
  gate.check(
    textureWork?.workers > 0 && textureWork?.replies > 0,
    `[noise] no job worker answered inside the preview, so the texture built on the main ` +
      `thread: ${brief(textureWork)}`
  );
  gate.check(noiseReport.textureWorkCleared === true, '[noise] the texture work status never cleared');
  const noiseInk = noiseReport.canvasReadback;
  gate.check(
    noiseInk.inkPixels >= NOISE_INK_FLOOR,
    `[noise] only ${noiseInk.inkPixels} ink pixels on a ${noiseInk.width}x${noiseInk.height} ` +
      `canvas, floor is ${NOISE_INK_FLOOR}: the noise texture did not draw`
  );

  checkHotReload(gate, reports['hot-reload'], reports['hot-reload-fresh']);
  const boxResult = checkBox(gate, reports.box, reports['box-hidden']);
  checkGltfExternal(gate, reports['gltf-external']);

  console.log('\n[gate] canvas readback');
  console.log(
    `  with-text     ${withInk.width}x${withInk.height}  ink=${withInk.inkPixels}` +
      `  opaque=${withInk.nonTransparentPixels}`
  );
  console.log(
    `  without-text  ${withoutInk.width}x${withoutInk.height}  ink=${withoutInk.inkPixels}` +
      `  opaque=${withoutInk.nonTransparentPixels}`
  );
  console.log(
    `  noise         ${noiseInk.width}x${noiseInk.height}  ink=${noiseInk.inkPixels}` +
      `  workers=${textureWork?.workers}  replies=${textureWork?.replies}`
  );
  const editedInk = reports['hot-reload'].edit?.canvasReadback;
  console.log(
    `  hot-reload    ink before=${reports['hot-reload'].canvasReadback.inkPixels}` +
      `  after=${editedInk?.inkPixels}  fresh=${reports['hot-reload-fresh'].canvasReadback.inkPixels}`
  );
  console.log(
    `  box           ${boxResult?.diffPixels} px differ from the twin` +
      `  mean=${JSON.stringify(boxResult?.colour)}  blue/red=${boxResult?.blueToRed}`
  );
  for (const run of runs) {
    const webview = reports[run.label].webview;
    console.log(
      `  ${run.label.padEnd(13)} csp=${webview.cspViolations.length}` +
        `  failed-requests=${webview.failedRequests.length}` +
        `  console-errors=${webview.consoleErrors.length}` +
        `  hosts=${JSON.stringify(webview.requestHosts)}`
    );
  }

  if (!gate.ok) {
    console.error('\n[gate] FAILED');
    for (const failure of gate.failures) console.error(`  - ${failure}`);
    console.error(`\n[gate] artifacts in ${OUT_ROOT}`);
    process.exitCode = 1;
    return;
  }
  console.log(
    '\n[gate] PASSED — a lit box draws in its material colour, glyphs and a worker-built texture paint in the real webview, offline, ' +
      'under the real CSP, a mesh edited on disk redraws in place, and a text glTF loads its files'
  );
}

await main();
