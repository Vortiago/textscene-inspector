#!/usr/bin/env node
/**
 * `pnpm test:e2e:web`: the gate for the web app's outliner, inspector, mode switching, phone
 * layout, file upload and drop, and load health, through `?fixture=` in the real running app. It
 * observes from outside (`cameraProbe.mjs`, DOM shape), so no production file carries a test hook.
 */
import { launchShowcaseBrowser } from '../showcase/browser.mjs';
import { inkStats } from '../vscode/pixels.mjs';
import {
  assertPortFree,
  ensureWebBuilt,
  killPreviewGroup,
  readViewportMode,
  settleCanvas,
  startPreview,
  waitForServer,
} from '../visual/previewServer.mjs';
import { installViewMatrixProbe, matricesEqual, formatMatrix } from './cameraProbe.mjs';
import {
  arraysEqual,
  describeNodePathMismatch,
  expandAllTreeRows,
  readOutlinerPaths,
  selectOutlinerNode,
} from './outliner.mjs';
import { findRowValue, readInspectorPanel } from './inspector.mjs';
import { openFixture } from './openFixture.mjs';
import { longTasksAfterFirstReply, longTasksDuringTextureWork } from './textureWorkProbe.mjs';
import {
  checkBlockedControl,
  checkStalledControl,
  checkWorkerArm,
  checkSettleControl,
  DELAY_FIXTURE,
  LARGE_FIXTURE,
  LARGE_TRES_FIXTURE,
  runLongTaskArms,
  runSettleControl,
} from './textureWorkScenarios.mjs';
import { checkDiagnostics } from './diagnostics.mjs';
import { checkPhoneLayout, runPhoneScenario } from './phoneScenario.mjs';
import {
  checkUploadScenarios,
  runDropUpload,
  runFileInputUpload,
  runRepeatedDrop,
} from './uploadScenarios.mjs';

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
// The 4096x4096 noise field, drawn at 1/8 scale, fills a 512x512 square: most of it is ink.
const INK_FLOOR_LARGE_TEXTURE = 20000;

async function run3DScenario(browser, baseUrl) {
  const { context, page, canvas, diagnostics } = await openFixture(browser, baseUrl, {
    fixture: FIXTURE_3D,
    label: '3D',
    initScripts: [[installViewMatrixProbe, undefined]],
  });

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
  const { context, page, canvas, diagnostics } = await openFixture(browser, baseUrl, {
    fixture: FIXTURE_2D,
    label: '2D',
  });

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

    console.log(`[gate] texture settle control: ${DELAY_FIXTURE}`);
    const settleControl = await runSettleControl(browser, baseUrl);

    console.log(
      `[gate] long tasks: ${LARGE_FIXTURE} with the worker, blocked and stalled, and ${LARGE_TRES_FIXTURE}`
    );
    const { withWorker, fromTres, blocked, stalled } = await runLongTaskArms(baseUrl);

    console.log(`[gate] phone scenario: ${FIXTURE_3D}`);
    const phone = await runPhoneScenario(browser, baseUrl, { fixture: FIXTURE_3D, selectPath: SELECT_A });

    console.log(`[gate] upload scenarios: file input, drop and repeated drop over ${FIXTURE_3D}`);
    const uploads = {
      fileInput: await runFileInputUpload(browser, baseUrl, { startFixture: FIXTURE_3D }),
      drop: await runDropUpload(browser, baseUrl, { startFixture: FIXTURE_3D }),
      repeatedDrop: await runRepeatedDrop(browser, baseUrl, { startFixture: FIXTURE_3D }),
    };

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

    checkSettleControl(gate, settleControl);
    const largeTexture = { inkOf: inkStats, inkFloor: INK_FLOOR_LARGE_TEXTURE };
    checkWorkerArm(gate, 'long tasks', withWorker, {
      ...largeTexture,
      longTasksIn: longTasksDuringTextureWork,
    });
    // The status clears only once the drawn map's banded upload completes, so a cleared
    // status and a reply show the `.tres` texture was built off-thread and uploaded to draw.
    checkWorkerArm(gate, 'long tasks, .tres material', fromTres, {
      ...largeTexture,
      longTasksIn: longTasksAfterFirstReply,
    });
    checkBlockedControl(gate, blocked);
    checkStalledControl(gate, stalled);
    checkDiagnostics(gate, '[long tasks]', withWorker.diagnostics);
    checkDiagnostics(gate, '[long tasks, .tres material]', fromTres.diagnostics);
    checkPhoneLayout(gate, phone, { expectedPaths: EXPECTED_3D_PATHS, selectName: 'Title' });
    checkUploadScenarios(gate, uploads);

    console.log('\n[gate] measurements');
    console.log(
      `  3D  canvas=${threeD.dims.width}x${threeD.dims.height} ink=${threeD.ink?.inkPixels} ` +
        `stage=${threeD.stage} nodes=${threeD.paths.length} camera-updates=${threeD.before?.updates}`
    );
    console.log(
      `  2D  canvas=${twoD.dims.width}x${twoD.dims.height} ink=${twoD.ink?.inkPixels} stage=${twoD.stage}`
    );
    console.log(
      `  texture settle  baseline=${settleControl.baseline.settledMs}ms delayed=${settleControl.delayed.settledMs}ms ` +
        `unwaited=${settleControl.unwaited.settledMs}ms workers=${settleControl.delayed.workers}`
    );
    // The Long Tasks API reports only tasks over 50 ms, so 0 means it saw none in the window.
    const longest = (tasks) => Math.max(0, ...(tasks ?? []).map((task) => task.duration));
    console.log(
      `  long tasks in the texture window  worker: replies=${withWorker.probe.replies} ` +
        `longest=${longest(longTasksDuringTextureWork(withWorker.probe, 0))}ms | ` +
        `.tres material after the reply: replies=${fromTres.probe.replies} ` +
        `longest=${longest(longTasksAfterFirstReply(fromTres.probe, 0))}ms | ` +
        `blocked: longest=${longest(longTasksDuringTextureWork(blocked.probe, 0))}ms | ` +
        `stalled after the reply: longest=${longest(longTasksAfterFirstReply(stalled.probe, 0))}ms`
    );
    console.log(
      `  phone  canvas=${phone.canvasBox?.width}x${phone.canvasBox?.height} ` +
        `sheet=${phone.dockBox?.width}x${phone.dockBox?.height} ` +
        `collapsed-canvas=${phone.collapsedCanvasBox?.width}x${phone.collapsedCanvasBox?.height}`
    );
    console.log(
      `  uploads  file-input ink=${uploads.fileInput.inkPixels} drop ink=${uploads.drop.inkPixels} ` +
        `scene-only drop ink=${uploads.repeatedDrop.sceneOnly.inkPixels} ` +
        `texture drop ink=${uploads.repeatedDrop.filled.inkPixels}`
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
