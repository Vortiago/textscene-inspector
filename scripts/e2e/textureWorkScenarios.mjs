/**
 * The web gate's procedural texture scenarios (ADR-0042). One proves the capture
 * harness waits for a texture still building, with a control that shows the wait
 * matters. The other proves a large build and its upload leave the main thread free,
 * with a control that shows the probe can see a long task.
 */
import {
  installStyle,
  paintedOutChromeCss,
  settleCanvas,
  TEXTURE_WORK_STATUS_TESTID,
  TEXTURE_WORK_WAIT_MS,
} from '../visual/previewServer.mjs';
import { launchGpuCompositedBrowser } from '../showcase/browser.mjs';
import { openFixture } from './openFixture.mjs';
import {
  installReplyStall,
  installTextureWorkProbe,
  installWorkerBlock,
  installWorkerDelay,
  longTasksAfterFirstReply,
  longTasksDuringTextureWork,
} from './textureWorkProbe.mjs';

/* global window */
// `window` exists only in the browser that runs the `page.evaluate` calls.

/** The 256x256 noise golden's scene: small, so each capture stays quick. */
export const DELAY_FIXTURE = 'unit-noisetexture2d.tscn';
/** 4096x4096 seamless: a build and an upload far past 50 ms if either ran on the main thread. */
export const LARGE_FIXTURE = 'unit-noisetexture2d-4096-seamless.tscn';
/** The same texture inside an external `.tres` material on a 3D mesh. */
export const LARGE_TRES_FIXTURE = 'unit-noisetexture2d-4096-tres.tscn';

/** How long the delayed arm holds the build back: far past the settle gate's first shot at 1.2 s. */
const WORKER_DELAY_MS = 6000;
/** The Long Tasks API's own threshold, and the limit for a responsive tab. */
const LONG_TASK_LIMIT_MS = 50;
/** The stall control's block in the reply task: well past the limit, well short of a timeout. */
const REPLY_STALL_MS = 120;

function openProbedFixture(browser, baseUrl, fixture, initScripts) {
  return openFixture(browser, baseUrl, {
    fixture,
    label: 'texture',
    initScripts: [[installTextureWorkProbe, TEXTURE_WORK_STATUS_TESTID], ...initScripts],
  });
}

async function captureSettled(browser, baseUrl, { delayWorker, waitForTextureWork }) {
  // The toolbar floats over the canvas, and its rounded corners rasterise one step apart
  // between runs, so the captures compare the scene only, as the goldens do.
  const initScripts = [[installStyle, paintedOutChromeCss({ canvas2D: false })]];
  if (delayWorker) initScripts.push([installWorkerDelay, WORKER_DELAY_MS]);
  const { context, page, canvas } = await openProbedFixture(browser, baseUrl, DELAY_FIXTURE, initScripts);
  const startedAt = Date.now();
  const { buffer, reason } = await settleCanvas(page, canvas, { waitForTextureWork });
  const settledMs = Date.now() - startedAt;
  const probe = await page.evaluate(() => window.__textureWorkProbe);
  await context.close();
  return { buffer, reason, settledMs, workers: probe.workers };
}

/**
 * Three captures of one scene: as it loads, with its build held back for
 * `WORKER_DELAY_MS`, and held back again with the settle wait turned off.
 */
export async function runSettleControl(browser, baseUrl) {
  const baseline = await captureSettled(browser, baseUrl, { delayWorker: false, waitForTextureWork: true });
  const delayed = await captureSettled(browser, baseUrl, { delayWorker: true, waitForTextureWork: true });
  const unwaited = await captureSettled(browser, baseUrl, { delayWorker: true, waitForTextureWork: false });
  return { baseline, delayed, unwaited };
}

/**
 * The long-task arms and their controls, in a GPU-composited browser of their own. The
 * default launch's software compositor would put GPU-process time on the main thread
 * (`browser.mjs`). `blocked` refuses the worker, so the build falls back to the main
 * thread. `stalled` blocks the task that receives the reply. Each control must show a
 * long task in its window, or that window proves nothing.
 */
export async function runLongTaskArms(baseUrl) {
  const browser = await launchGpuCompositedBrowser();
  try {
    const withWorker = await runLongTaskScenario(browser, baseUrl, LARGE_FIXTURE, []);
    const fromTres = await runLongTaskScenario(browser, baseUrl, LARGE_TRES_FIXTURE, []);
    const blocked = await runLongTaskScenario(browser, baseUrl, LARGE_FIXTURE, [
      [installWorkerBlock, undefined],
    ]);
    const stalled = await runLongTaskScenario(browser, baseUrl, LARGE_FIXTURE, [
      [installReplyStall, REPLY_STALL_MS],
    ]);
    return { withWorker, fromTres, blocked, stalled };
  } finally {
    await browser.close();
  }
}

/**
 * Opens a 4096x4096 scene with `initScripts` after the probe, and records the page's
 * long tasks until the texture work status has come and gone.
 */
async function runLongTaskScenario(browser, baseUrl, fixture, initScripts) {
  const { context, page, canvas, diagnostics } = await openProbedFixture(
    browser,
    baseUrl,
    fixture,
    initScripts
  );
  await page.waitForFunction(
    () => {
      const probe = window.__textureWorkProbe;
      return probe.statusAttached.length > 0 && probe.statusDetached.length === probe.statusAttached.length;
    },
    undefined,
    { timeout: TEXTURE_WORK_WAIT_MS }
  );
  const settled = await settleCanvas(page, canvas);
  const probe = await page.evaluate(() => window.__textureWorkProbe);
  await context.close();
  return { probe, settled, diagnostics };
}

/** The settle control's claims, as `gate.check` calls. */
export function checkSettleControl(gate, { baseline, delayed, unwaited }) {
  gate.check(!!baseline.buffer, `[texture settle] the baseline capture never settled: ${baseline.reason}`);
  gate.check(!!delayed.buffer, `[texture settle] the delayed capture never settled: ${delayed.reason}`);
  gate.check(
    delayed.workers > 0,
    '[texture settle] the page started no job worker, so the delay held back nothing and proves nothing'
  );
  gate.check(
    delayed.settledMs >= WORKER_DELAY_MS,
    `[texture settle] the delayed capture settled after ${delayed.settledMs} ms, before the ` +
      `${WORKER_DELAY_MS} ms the build was held back: it cannot have waited for the texture`
  );
  if (baseline.buffer && delayed.buffer) {
    gate.check(
      delayed.buffer.equals(baseline.buffer),
      '[texture settle] the delayed capture differs from the baseline: the harness settled on a ' +
        'frame without the texture'
    );
  }
  if (baseline.buffer && unwaited.buffer) {
    gate.check(
      !unwaited.buffer.equals(baseline.buffer),
      '[texture settle] with the wait off, the delayed capture still matches the baseline: the ' +
        'delay is not visible, so the waited capture proves nothing'
    );
  }
}

/**
 * The long-task claims for each worker arm, labelled by `label`: the worker answered, no task
 * over the limit ran in the window `longTasksIn` measures, and the texture drew.
 */
export function checkWorkerArm(gate, label, arm, { inkOf, inkFloor, longTasksIn }) {
  const during = longTasksIn(arm.probe, LONG_TASK_LIMIT_MS);
  gate.check(during !== null, `[${label}] the texture work status never came and went: nothing was measured`);
  gate.check(
    arm.probe.replies > 0,
    `[${label}] no job worker answered: the build did not run off the main thread`
  );
  gate.check(
    during !== null && during.length === 0,
    `[${label}] ${during?.length} task(s) over ${LONG_TASK_LIMIT_MS} ms while the texture built and uploaded: ` +
      JSON.stringify(during?.slice(0, 5))
  );
  const ink = arm.settled.buffer ? inkOf(arm.settled.buffer) : null;
  gate.check(
    !!ink && ink.inkPixels >= inkFloor,
    `[${label}] the 4096x4096 texture drew ${ink?.inkPixels} ink pixels, floor ${inkFloor}`
  );
}

/** The control that blocks the worker must see a long task, or the probe cannot see one. */
export function checkBlockedControl(gate, blocked) {
  const blockedDuring = longTasksDuringTextureWork(blocked.probe, LONG_TASK_LIMIT_MS);
  gate.check(
    blockedDuring !== null && blockedDuring.length > 0,
    '[long tasks] with the worker blocked, the in-thread build showed no long task: the probe ' +
      'cannot see one, so the worker arm proves nothing'
  );
}

/** The control that stalls the reply task must see a long task after the reply. */
export function checkStalledControl(gate, stalled) {
  const afterReply = longTasksAfterFirstReply(stalled.probe, LONG_TASK_LIMIT_MS);
  gate.check(
    afterReply !== null && afterReply.length > 0,
    `[long tasks] a ${REPLY_STALL_MS} ms stall in the reply task showed no long task after the ` +
      'reply: that window cannot see one, so the .tres arm proves nothing'
  );
}
