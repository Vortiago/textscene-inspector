#!/usr/bin/env node
/**
 * End-to-end gate for the WEB PREVIEWER APP itself — not the renderer.
 *
 * Everything else that touches a real browser drives the app without
 * asserting anything (`scripts/showcase/` records docs clips) or asserts only
 * the renderer's pixels with the app's own chrome hidden
 * (`scripts/visual/run.mjs`). That leaves the app's interaction surface —
 * outliner, inspector, mode switching, load health — with no gate at all, and
 * one of the rules it is supposed to enforce ("the camera never moves on
 * selection") has already regressed once and been reverted with nothing but
 * unit tests to show for it.
 *
 * Assertions, against two fixtures loaded through the REAL running app
 * (`?fixture=`, same navigation path a user follows):
 *
 *   3D  (`unit-box-mesh.tscn`, 4 nodes, no external resources — deterministic)
 *     - the viewport camera's GL-uploaded `viewMatrix` is byte-identical
 *       across two different tree selections (`cameraProbe.mjs`)
 *     - the outliner lists exactly the fixture's 4 node paths, in order
 *     - the inspector shows the selected Label3D's authored `text`
 *     - the scene opens in the 3D workspace, with a sized canvas AND ink
 *       checked separately (a dead GL context reads 0 ink either way)
 *     - zero console errors / pageerrors / failed requests
 *
 *   2D  (`unit-sprite2d.tscn`, references one local PNG)
 *     - the scene opens in the 2D workspace (`readViewportMode`,
 *       `previewServer.mjs` — shared with the visual-regression gate)
 *     - sized canvas + ink, same separated guard
 *     - zero console errors / pageerrors / failed requests
 *
 * Observation is from OUTSIDE the app throughout: `context.addInitScript`
 * patches `WebGL(2)RenderingContext.prototype` for the camera probe (see
 * `cameraProbe.mjs`) the same way `scripts/vscode/driveScene.mjs` patches
 * `HTMLCanvasElement.prototype.getContext` for its own canvas readback; the
 * outliner/inspector readers walk plain DOM shape, never a class name (CSS
 * Modules hash those in the built app). No production file was touched to
 * build this gate.
 *
 *   pnpm test:e2e:web
 */
import { launchShowcaseBrowser } from '../showcase/browser.mjs';
import { inkStats } from '../vscode/pixels.mjs';
import {
  assertPortFree,
  ensureWebBuilt,
  findCanvas,
  gotoFixture,
  killPreviewGroup,
  readViewportMode,
  settleCanvas,
  startPreview,
  waitForServer,
} from '../visual/previewServer.mjs';
import { installViewMatrixProbe, matricesEqual, formatMatrix } from './cameraProbe.mjs';
import { arraysEqual, describeNodePathMismatch, expandAllTreeRows, readOutlinerPaths, selectOutlinerNode } from './outliner.mjs';
import { findRowValue, readInspectorPanel } from './inspector.mjs';

/* global window */
// `window` exists only inside the `page.evaluate` calls below, which
// Playwright serialises and runs in the browser, never in this Node process.

const PORT = Number(process.env.E2E_WEB_PORT) || 4321;

// --- Fixtures ---------------------------------------------------------------

// scenes/fixtures/unit-box-mesh.tscn: no ExtResource, no external material —
// deterministic geometry AND deterministic node set. Node order below is the
// fixture's authored child order (TreeNode renders children in that order).
const FIXTURE_3D = 'unit-box-mesh.tscn';
const EXPECTED_3D_PATHS = ['Root', 'Root/Box', 'Root/Title', 'Root/Description'];
// Label3D nodes with a distinctive authored `text` — the inspector assertion
// reads this back through the SAME formatter path Godot-parity relies on.
const SELECT_A = 'Root/Title';
const SELECT_A_TEXT = 'BoxMesh Test';
const SELECT_B = 'Root/Description';

// scenes/fixtures/unit-sprite2d.tscn: Node2D root (2D workspace, ADR-0006),
// references one local PNG — a legitimate same-origin fetch, not a failure.
const FIXTURE_2D = 'unit-sprite2d.tscn';

// Settle window after a selection click: SelectionHighlight + inspector
// re-render synchronously off React state, no async resource load involved
// (matches the fixed post-interaction wait `scripts/showcase/record.mjs`'s
// `clickNode` uses).
const SELECT_SETTLE_MS = 400;

// Measured on a passing run: 3D ~195k ink px, 2D ~28k, on a 631x756 canvas
// (1280x800 viewport minus the dock/header chrome). Deliberately far below
// either count, the same policy `scripts/vscode/webview-csp-gate.mjs`
// documents for its own INK_FLOOR: the failure being guarded (nothing drawn
// at all) reads as 0 on any display, so the floor only needs to clear noise,
// not track the exact count.
const INK_FLOOR_3D = 20000;
const INK_FLOOR_2D = 4000;

// --- Diagnostics --------------------------------------------------------

/** Console errors, uncaught page errors, and failed requests — offline app, so all three should stay empty. */
function attachDiagnostics(page) {
  const consoleErrors = [];
  const pageErrors = [];
  const failedRequests = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => pageErrors.push(String(error)));
  page.on('requestfailed', (request) => {
    failedRequests.push({ url: request.url(), failure: request.failure()?.errorText });
  });
  return { consoleErrors, pageErrors, failedRequests };
}

// --- Scenarios ------------------------------------------------------------

async function run3DScenario(browser, baseUrl) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  // Registered before any navigation, so it is present for the FIRST paint —
  // Playwright re-runs every addInitScript on every subsequent navigation in
  // this context too, which matters not at all here (one goto) but matches
  // the contract documented in cameraProbe.mjs.
  await context.addInitScript(installViewMatrixProbe);
  const page = await context.newPage();
  const diagnostics = attachDiagnostics(page);

  await gotoFixture(page, baseUrl, FIXTURE_3D);
  const { canvas, reason: canvasReason } = await findCanvas(page);
  if (canvasReason) throw new Error(`[3D] ${canvasReason}`);

  const settled = await settleCanvas(page, canvas);
  const dims = await canvas.evaluate((el) => ({ width: el.width, height: el.height }));
  const stage = await readViewportMode(page);

  const before = await page.evaluate(() => window.__tscnReadViewMatrix());

  await expandAllTreeRows(page);
  const paths = await readOutlinerPaths(page);

  await selectOutlinerNode(page, SELECT_A);
  await page.waitForTimeout(SELECT_SETTLE_MS);
  const afterA = await page.evaluate(() => window.__tscnReadViewMatrix());
  const inspectorA = await readInspectorPanel(page);

  await selectOutlinerNode(page, SELECT_B);
  await page.waitForTimeout(SELECT_SETTLE_MS);
  const afterB = await page.evaluate(() => window.__tscnReadViewMatrix());

  await context.close();

  return {
    dims,
    stage,
    settleReason: settled.reason,
    ink: settled.buffer ? inkStats(settled.buffer) : null,
    before,
    afterA,
    afterB,
    paths,
    inspectorA,
    diagnostics,
  };
}

async function run2DScenario(browser, baseUrl) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  const diagnostics = attachDiagnostics(page);

  await gotoFixture(page, baseUrl, FIXTURE_2D);
  const { canvas, reason: canvasReason } = await findCanvas(page);
  if (canvasReason) throw new Error(`[2D] ${canvasReason}`);

  const settled = await settleCanvas(page, canvas);
  const dims = await canvas.evaluate((el) => ({ width: el.width, height: el.height }));
  const stage = await readViewportMode(page);

  await context.close();

  return {
    dims,
    stage,
    settleReason: settled.reason,
    ink: settled.buffer ? inkStats(settled.buffer) : null,
    diagnostics,
  };
}

// --- Assertions -------------------------------------------------------------

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

// A canvas whose WebGL context creation fails STAYS AT the browser's default
// unsized 300x150 (three.js catches the error and never resizes it) — bigger
// than the >50 floor `scripts/vscode/driveScene.mjs` uses for a cramped VS
// Code editor pane, so that floor would NOT catch this here. This gate's
// canvas is always the dominant part of a fixed 1280x800 viewport (settles at
// ~631x756 — see the measurements comment above), so 400 sits well above the
// dead-context default and well below every real reading.
const MIN_SIZED_CANVAS_DIMENSION = 400;

/** Sized canvas, checked SEPARATELY from ink: a dead GL context reads 0 ink too, and must not read as "nothing drawn". */
function checkSizedCanvas(gate, label, dims) {
  gate.check(
    dims.width > MIN_SIZED_CANVAS_DIMENSION && dims.height > MIN_SIZED_CANVAS_DIMENSION,
    `${label} canvas never produced a properly sized surface (${dims.width}x${dims.height}) — WebGL ` +
      'context creation likely failed (three.js leaves the canvas at its unsized 300x150 default), ' +
      'so the ink check below says nothing'
  );
}

function checkInk(gate, label, ink, floor) {
  gate.check(!!ink, `${label} canvas never settled, so it was never screenshotted for an ink count`);
  if (ink) {
    gate.check(
      ink.inkPixels >= floor,
      `${label} only ${ink.inkPixels} ink pixels on a ${ink.width}x${ink.height} canvas, floor is ` +
        `${floor} — nothing rendered`
    );
  }
}

function checkStage(gate, label, actual, expected) {
  gate.check(actual === expected, `${label} opened in the "${actual}" workspace, expected "${expected}"`);
}

function checkDiagnostics(gate, label, diagnostics) {
  gate.check(
    diagnostics.consoleErrors.length === 0,
    `${label} ${diagnostics.consoleErrors.length} console error(s): ${diagnostics.consoleErrors.slice(0, 3).join(' | ')}`
  );
  gate.check(
    diagnostics.pageErrors.length === 0,
    `${label} ${diagnostics.pageErrors.length} uncaught page error(s): ${diagnostics.pageErrors.slice(0, 3).join(' | ')}`
  );
  gate.check(
    diagnostics.failedRequests.length === 0,
    `${label} ${diagnostics.failedRequests.length} failed request(s): ` +
      diagnostics.failedRequests.slice(0, 3).map((r) => `${r.failure} ${r.url}`).join(' | ')
  );
}

// --- Main -------------------------------------------------------------------

async function main() {
  ensureWebBuilt(console.log);
  await assertPortFree(PORT, 'E2E_WEB_PORT');
  const { proc, baseUrl } = startPreview(PORT);

  let browser;
  const gate = new GateFailures();
  try {
    await waitForServer(baseUrl);
    browser = await launchShowcaseBrowser();

    console.log(`\n[gate] 3D scenario: ${FIXTURE_3D}`);
    const threeD = await run3DScenario(browser, baseUrl);

    console.log(`[gate] 2D scenario: ${FIXTURE_2D}`);
    const twoD = await run2DScenario(browser, baseUrl);

    // --- 3D fixture ---
    checkSizedCanvas(gate, '[3D]', threeD.dims);
    checkInk(gate, '[3D]', threeD.ink, INK_FLOOR_3D);
    checkStage(gate, '[3D]', threeD.stage, '3d');
    checkDiagnostics(gate, '[3D]', threeD.diagnostics);

    if (!arraysEqual(EXPECTED_3D_PATHS, threeD.paths)) {
      const { missing, extra } = describeNodePathMismatch(EXPECTED_3D_PATHS, threeD.paths);
      gate.check(
        false,
        `[outliner] node paths do not match ${FIXTURE_3D}: got [${threeD.paths.join(', ')}], ` +
          `expected [${EXPECTED_3D_PATHS.join(', ')}] (missing: [${missing.join(', ')}], extra: [${extra.join(', ')}])`
      );
    }

    gate.check(
      threeD.inspectorA?.name === 'Title',
      `[inspector] selecting ${SELECT_A} shows "${threeD.inspectorA?.name}" in the panel title, expected "Title"`
    );
    const textValue = findRowValue(threeD.inspectorA?.sections, 'Text', 'Text');
    gate.check(
      textValue === SELECT_A_TEXT,
      `[inspector] Text section's Text row reads "${textValue}", expected "${SELECT_A_TEXT}"`
    );

    gate.check(
      !!threeD.before && threeD.before.updates > 0,
      '[camera] the viewMatrix probe never captured an upload — nothing to compare, ' +
        'this assertion would prove nothing either way'
    );
    if (threeD.before) {
      gate.check(
        matricesEqual(threeD.before.matrix, threeD.afterA.matrix),
        `[camera] view matrix changed after selecting ${SELECT_A} — camera moved on selection\n` +
          `    before: ${formatMatrix(threeD.before.matrix)}\n` +
          `    after:  ${formatMatrix(threeD.afterA?.matrix)}`
      );
      gate.check(
        matricesEqual(threeD.afterA.matrix, threeD.afterB.matrix),
        `[camera] view matrix changed after selecting ${SELECT_B} (a SECOND, different selection) — ` +
          `camera moved on selection\n` +
          `    after ${SELECT_A}: ${formatMatrix(threeD.afterA?.matrix)}\n` +
          `    after ${SELECT_B}: ${formatMatrix(threeD.afterB?.matrix)}`
      );
    }

    // --- 2D fixture ---
    checkSizedCanvas(gate, '[2D]', twoD.dims);
    checkInk(gate, '[2D]', twoD.ink, INK_FLOOR_2D);
    checkStage(gate, '[2D]', twoD.stage, '2d');
    checkDiagnostics(gate, '[2D]', twoD.diagnostics);

    console.log('\n[gate] measurements');
    console.log(
      `  3D  canvas=${threeD.dims.width}x${threeD.dims.height} ink=${threeD.ink?.inkPixels} ` +
        `stage=${threeD.stage} nodes=${threeD.paths.length} camera-updates=${threeD.before?.updates}`
    );
    console.log(
      `  2D  canvas=${twoD.dims.width}x${twoD.dims.height} ink=${twoD.ink?.inkPixels} stage=${twoD.stage}`
    );
  } finally {
    if (browser) await browser.close().catch(() => {});
    killPreviewGroup(proc);
  }

  if (!gate.ok) {
    console.error('\n[gate] FAILED');
    for (const failure of gate.failures) console.error(`  - ${failure}`);
    process.exitCode = 1;
    return;
  }
  console.log('\n[gate] PASSED');
}

await main();
