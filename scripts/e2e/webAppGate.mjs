#!/usr/bin/env node
/**
 * `pnpm test:e2e:web`: the gate for the web app's outliner, inspector, mode
 * switching and load health, through `?fixture=` in the real running app. It
 * observes from outside (`cameraProbe.mjs`, DOM shape), so no production file
 * carries a test hook.
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
// `window` exists only in the browser that runs the `page.evaluate` calls.

const PORT = Number(process.env.E2E_WEB_PORT) || 4321;

// No external resource, so the geometry and node set are deterministic. The
// order is the fixture's authored child order, which TreeNode renders.
const FIXTURE_3D = 'unit-box-mesh.tscn';
const EXPECTED_3D_PATHS = ['Root', 'Root/Box', 'Root/Title', 'Root/Description'];
// Label3D nodes with a distinctive authored `text`, read back through the
// formatter path Godot parity relies on. The viewMatrix must not move between
// the two selections.
const SELECT_A = 'Root/Title';
const SELECT_A_TEXT = 'BoxMesh Test';
const SELECT_B = 'Root/Description';

// A Node2D root (2D workspace, ADR-0006) with one local PNG, a same-origin
// fetch and not a failure.
const FIXTURE_2D = 'unit-sprite2d.tscn';

// A selection re-renders synchronously off React state, so a fixed wait
// suffices, as in `clickNode` in `scripts/showcase/record.mjs`.
const SELECT_SETTLE_MS = 400;

// Far below a passing run (3D ~195k ink px, 2D ~28k, on a 631x756 canvas), as
// in `scripts/vscode/webview-csp-gate.mjs`: nothing drawn reads as 0 on any
// display, so the floor only clears noise.
const INK_FLOOR_3D = 20000;
const INK_FLOOR_2D = 4000;

/** Console errors, uncaught page errors and failed requests. The app is offline, so all stay empty. */
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

async function run3DScenario(browser, baseUrl) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  // Registered before any navigation, so it is present for the first paint.
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

// three.js catches a failed WebGL context and never resizes the canvas from the
// browser's 300x150, above the >50 floor `scripts/vscode/driveScene.mjs` uses.
// This canvas fills most of a 1280x800 viewport (~631x756), so 400 splits them.
const MIN_SIZED_CANVAS_DIMENSION = 400;

/** Sized canvas, checked apart from ink: a dead GL context reads 0 ink too. */
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
