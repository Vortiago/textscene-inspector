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
  installTextureWorkProbe,
  installWorkerBlock,
  installWorkerDelay,
  longTasksDuringTextureWork,
} from './textureWorkProbe.mjs';

/* global window */
// `window` exists only in the browser that runs the `page.evaluate` calls.

/** The 256x256 noise golden's scene: small, so each capture stays quick. */
export const DELAY_FIXTURE = 'unit-noisetexture2d.tscn';
/** 4096x4096 seamless: a build and an upload far past 50 ms if either ran on the main thread. */
export const LARGE_FIXTURE = 'unit-noisetexture2d-4096-seamless.tscn';

/** How long the delayed arm holds the build back: far past the settle gate's first shot at 1.2 s. */
const WORKER_DELAY_MS = 6000;
/** The Long Tasks API's own threshold, and the limit for a responsive tab. */
const LONG_TASK_LIMIT_MS = 50;

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
 * Both long-task arms, in a GPU-composited browser of their own. The default launch's
 * software compositor would put GPU-process time on the main thread (`browser.mjs`).
 */
export async function runLongTaskArms(baseUrl) {
  const browser = await launchGpuCompositedBrowser();
  try {
    const withWorker = await runLongTaskScenario(browser, baseUrl, { blockWorker: false });
    const blocked = await runLongTaskScenario(browser, baseUrl, { blockWorker: true });
    return { withWorker, blocked };
  } finally {
    await browser.close();
  }
}

/**
 * Opens the 4096x4096 scene and records the page's long tasks until the texture work
 * status has come and gone. `blockWorker` refuses the worker, so the build falls back
 * to the main thread: the control that proves the probe sees a long task.
 */
async function runLongTaskScenario(browser, baseUrl, { blockWorker }) {
  const initScripts = blockWorker ? [[installWorkerBlock, undefined]] : [];
  const { context, page, canvas, diagnostics } = await openProbedFixture(browser, baseUrl, LARGE_FIXTURE, initScripts);
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

/** The long-task claims for the worker arm and for the control that blocks the worker. */
export function checkLongTasks(gate, withWorker, blocked, inkOf, inkFloor) {
  const during = longTasksDuringTextureWork(withWorker.probe, LONG_TASK_LIMIT_MS);
  gate.check(during !== null, '[long tasks] the texture work status never came and went: nothing was measured');
  gate.check(withWorker.probe.replies > 0, '[long tasks] no job worker answered: the build did not run off the main thread');
  gate.check(
    during !== null && during.length === 0,
    `[long tasks] ${during?.length} task(s) over ${LONG_TASK_LIMIT_MS} ms while the texture built and uploaded: ` +
      JSON.stringify(during?.slice(0, 5))
  );
  const ink = withWorker.settled.buffer ? inkOf(withWorker.settled.buffer) : null;
  gate.check(
    !!ink && ink.inkPixels >= inkFloor,
    `[long tasks] the 4096x4096 texture drew ${ink?.inkPixels} ink pixels, floor ${inkFloor}`
  );

  const blockedDuring = longTasksDuringTextureWork(blocked.probe, LONG_TASK_LIMIT_MS);
  gate.check(
    blockedDuring !== null && blockedDuring.length > 0,
    '[long tasks] with the worker blocked, the in-thread build showed no long task: the probe ' +
      'cannot see one, so the worker arm proves nothing'
  );
}
