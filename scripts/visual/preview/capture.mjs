/**
 * Opens a fixture and gets one trustworthy frame out of it: the app's own resource chain awaited,
 * the requested scene confirmed, and the canvas proven settled before it is read.
 */

/* global document */ // The loading status predicates run in the browser.

import {
  FIXTURE_LOADING_TESTID,
  NETWORK_IDLE_MS,
  SCENE_LOAD_STATUS_TESTID,
  SCENE_LOAD_WAIT_MS,
  SETTLE_INITIAL_MS,
  SETTLE_INTERVAL_MS,
  SETTLE_MAX_ATTEMPTS,
  SETTLE_SIM_SECONDS,
  TEXTURE_WORK_STATUS_TESTID,
} from './appContract.mjs';
import { fixtureUrl } from './fixtureUrl.mjs';
import { findCanvas2DFrame } from './viewportProbes.mjs';
import { targetShooter } from './targetShot.mjs';
import { writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';

/**
 * Navigates to a fixture and waits for the app's own resource chain to go quiet. `load` fires
 * first: a scene fetches its .tscn, then an ArrayMesh .tres, its material and that texture, each
 * found only after the previous one parsed. Otherwise the settle gate accepts two identical
 * frames of the untextured placeholder. A scene that never idles still falls through to the gate.
 */
export async function gotoFixture(page, baseUrl, fixture, onSlow = () => {}, extraParams = {}) {
  await page.goto(fixtureUrl(baseUrl, fixture, extraParams), { waitUntil: 'load' });
  await page.waitForLoadState('networkidle', { timeout: NETWORK_IDLE_MS }).catch((err) => {
    // Anything but a timeout, such as a crashed target or a closed page, is a real failure.
    if (err?.name !== 'TimeoutError') throw err;
    onSlow(NETWORK_IDLE_MS);
  });
  assertOpenedFixture(page, fixture);
}

/**
 * Fails when the app did not open the requested fixture. `useFixtureSelection` falls back to the
 * stored or default scene for an unknown `?fixture=`, which suits a shared link but not a
 * measurement. It writes the scene it opened back into the URL, which this reads.
 */
function assertOpenedFixture(page, requested) {
  const opened = new URL(page.url()).searchParams.get('fixture');
  if (opened === requested) return;
  throw new Error(
    `previewer opened "${opened ?? '(none)'}" but "${requested}" was requested — ` +
      'the name must match apps/textscene-web/src/fixtures.ts exactly ' +
      '(run `pnpm generate:fixtures` if the scene is new)'
  );
}

/** The single canvas the scene renders into, or a reason there is not exactly one. */
export async function findCanvas(page) {
  const canvases = page.locator('canvas');
  try {
    // 90 s: under host contention with software GL a healthy scene can take over 30 s to first
    // paint. A timeout reports, so one slow scene costs one 'unstable' row, not the whole run.
    await canvases.first().waitFor({ timeout: 90000 });
  } catch {
    return { canvas: null, reason: 'no canvas appeared within 90s' };
  }
  const count = await canvases.count();
  if (count !== 1) return { canvas: null, reason: `expected exactly 1 canvas, found ${count}` };
  return { canvas: canvases.first(), reason: null };
}

/**
 * Opens `fixture` and finds the element a capture clips to: the start every capture shares. Answers
 * `{ target, reason }`, with a null target and a reason when there is none.
 */
export async function openScene(page, baseUrl, fixture, { canvas2D = false, camera, onSlow } = {}) {
  await gotoFixture(page, baseUrl, fixture, onSlow, { camera });
  return findCaptureTarget(page, { canvas2D });
}

/**
 * The element a capture clips to: the 2D comparison frame when the scene opened
 * in the 2D workspace, the scene canvas otherwise. One call so a caller cannot
 * pick the 2D context and then screenshot the 3D element.
 */
export async function findCaptureTarget(page, { canvas2D = false } = {}) {
  if (canvas2D) {
    const { frame, reason } = await findCanvas2DFrame(page);
    return { target: frame, reason };
  }
  const { canvas, reason } = await findCanvas(page);
  return { target: canvas, reason };
}

/**
 * Screenshots the canvas once two consecutive captures are byte-identical, and never while a
 * loading status is on the page. A scene that never settles returns a reason instead of a frame,
 * so flakiness is rejected here, not absorbed by a tolerance downstream.
 * `waitForTextureWork: false` exists only for the control that proves the texture wait matters.
 */
export async function settleCanvas(
  page,
  canvas,
  { screenshotTimeout, simSeconds = SETTLE_SIM_SECONDS, waitForTextureWork = true } = {}
) {
  if (simSeconds !== 0) {
    throw new Error(
      `settle contract asks for ${simSeconds}s of simulated time, and this side cannot reach ` +
        'it: the previewer runs no global clock (the animation transport starts stopped, ' +
        'nothing steps physics or GDScript) and settling is a convergence test, not a seek. ' +
        'Reaching a non-zero settle needs a driveable elapsed-time hook in the renderer first.'
    );
  }
  // A whole game world under SwiftShader can take longer to rasterise one frame than Playwright's
  // default action timeout. A per-scene raise keeps an ordinary scene's hang quick to report.
  const shooter = targetShooter(canvas, { timeout: screenshotTimeout });
  const shot = () => shooter.shoot();
  const statusIds = waitForTextureWork ? LOADING_STATUS_IDS : SCENE_STATUS_IDS;
  await page.waitForTimeout(SETTLE_INITIAL_MS);
  const loading = await statusesStillAttached(page, statusIds);
  if (loading) return { buffer: null, reason: loading };
  let prev = await shot();
  for (let attempt = 0; attempt < SETTLE_MAX_ATTEMPTS; attempt++) {
    await page.waitForTimeout(SETTLE_INTERVAL_MS);
    // Work that started since the last shot means that shot is not a candidate: wait it
    // out, then start the comparison again from a fresh frame.
    if (await anyStatusAttached(page, statusIds)) {
      const stillLoading = await statusesStillAttached(page, statusIds);
      if (stillLoading) return { buffer: null, reason: stillLoading };
      prev = await shot();
      continue;
    }
    const cur = await shot();
    if (!cur.equals(prev)) {
      prev = cur;
      continue;
    }
    // The box is measured once per settle, so a target that resized since gives matching crops.
    // A changed box restarts the comparison from a shot of the new box.
    if (!(await shooter.boxChanged())) return { buffer: cur, reason: null };
    prev = await shot();
  }
  return {
    buffer: null,
    reason: `never settled: ${SETTLE_MAX_ATTEMPTS} captures over ${
      SETTLE_MAX_ATTEMPTS * SETTLE_INTERVAL_MS
    }ms all differed`,
  };
}

/** The statuses of a scene not yet whole: its fixture fetch and its load. */
const SCENE_STATUS_IDS = [FIXTURE_LOADING_TESTID, SCENE_LOAD_STATUS_TESTID];
/** Those, and the texture work that follows them. Each gives way to the next. */
const LOADING_STATUS_IDS = [...SCENE_STATUS_IDS, TEXTURE_WORK_STATUS_TESTID];

/**
 * The reason the scene is still loading, or null once it is whole: fetched, drawn, its resources
 * landed and its texture work ended. One check reads every status, since each gives way to the next.
 */
export function sceneStillLoading(page) {
  return statusesStillAttached(page, LOADING_STATUS_IDS);
}

/** Waits until no element carries one of `ids`. Answers null then, or the reason it gave up. */
async function statusesStillAttached(page, ids) {
  try {
    await page.waitForFunction(
      (statusIds) => statusIds.every((id) => !document.querySelector(`[data-testid="${id}"]`)),
      ids,
      { timeout: SCENE_LOAD_WAIT_MS }
    );
    return null;
  } catch (error) {
    if (error?.name === 'TimeoutError') return `scene still loading after ${SCENE_LOAD_WAIT_MS}ms`;
    throw new Error(`waiting for the scene to load: ${error}`, { cause: error });
  }
}

/** True while an element carries one of `ids`. */
function anyStatusAttached(page, ids) {
  return page.evaluate(
    (statusIds) => statusIds.some((id) => document.querySelector(`[data-testid="${id}"]`)),
    ids
  );
}

/** Every pixel the same RGBA: a dead GL context or an unrendered scene, never a real frame. */
export function isUniformImage(buffer) {
  const { data } = PNG.sync.read(buffer);
  const [r0, g0, b0, a0] = data;
  for (let i = 4; i < data.length; i += 4) {
    if (data[i] !== r0 || data[i + 1] !== g0 || data[i + 2] !== b0 || data[i + 3] !== a0) {
      return false;
    }
  }
  return true;
}

/**
 * Writes a capture, refusing a uniform one. Two captures of a lost context pass `settleCanvas`. A
 * compare then fails on the diff, but a blank baseline, once written, passes every later compare.
 */
export function writeCaptureImage(path, buffer, what) {
  if (isUniformImage(buffer)) {
    throw new Error(
      `${what}: capture is a single uniform colour throughout — refusing to write it ` +
        `to ${path}. That is a lost WebGL context or an unrendered scene, never a real ` +
        'capture; a node that draws nothing belongs on a `visual: false` sheet.'
    );
  }
  writeFileSync(path, buffer);
}
