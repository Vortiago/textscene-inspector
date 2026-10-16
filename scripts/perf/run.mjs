#!/usr/bin/env node
/**
 * The work budget check: each budget scene, settled in headless Chromium with the Performance
 * overlay on, must draw no more calls and run no render step more often per frame than
 * budgets.json allows. Counts, not times, so software GL on a shared runner measures the same
 * work as a developer's GPU.
 *
 * @example
 *   pnpm test:perf                  # compare every budget scene against budgets.json
 *   pnpm test:perf:update           # rewrite budgets.json from this run, then review and commit it
 *   node scripts/perf/run.mjs --scene glow
 */

/* global document, window */ // The addInitScript and evaluate callbacks run in the browser.

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import { SWIFTSHADER_GL_ARGS } from '../showcase/browser.mjs';
import {
  assertPortFree,
  createCaptureContext,
  ensureWebBuilt,
  findCanvas,
  gotoFixture,
  killPreviewGroup,
  PERFORMANCE_TESTIDS,
  SETTLE_INITIAL_MS,
  SHOW_PERFORMANCE_STORAGE_KEY,
  startPreview,
  TEXTURE_WORK_STATUS_TESTID,
  textureWorkCleared,
  waitForServer,
  warmUpGLContext,
} from '../visual/previewServer.mjs';
import { attachConsoleGate } from '../visual/run/sceneCapture.mjs';
import { BUDGET_SCENES } from './scenes.mjs';
import { SteadyWork } from './steadyWork.mjs';
import { compareToBudget, parseWorkCounts } from './workCounts.mjs';

const BUDGETS_PATH = resolve(import.meta.dirname, 'budgets.json');

// Clear of the visual gate's 4317, so both can run on one host.
const PORT = Number(process.env.PERF_PORT) || 4319;

/** Shorter than the overlay's 500 ms window, so no window goes unread. */
const READ_INTERVAL_MS = 250;
/** A large demo under software GL loads in tens of seconds and draws a few frames a second. */
const MAX_STEADY_WAIT_MS = 180000;

async function main() {
  const { update, scene: only } = parseArgs(process.argv.slice(2));
  const scenes = only ? BUDGET_SCENES.filter((s) => s.name === only) : BUDGET_SCENES;
  if (scenes.length === 0) fail(`no budget scene named "${only}"`, 2);

  ensureWebBuilt();
  await assertPortFree(PORT);
  const { proc, baseUrl } = startPreview(PORT);
  let browser;
  const measured = {};
  const unmeasured = [];
  try {
    await waitForServer(`${baseUrl}/`);
    browser = await chromium.launch({ headless: true, args: SWIFTSHADER_GL_ARGS });
    await warmUpGLContext(browser);
    const profiled = await profiledPage(browser);
    for (const scene of scenes) {
      const { work, reason } = await measureScene(profiled, baseUrl, scene);
      if (work) measured[scene.name] = work;
      else unmeasured.push(`${scene.name}: ${reason}`);
      console.log(`[perf] ${scene.name} ${work ? `${work.drawCalls} draw calls` : 'not measured'}`);
    }
  } finally {
    try {
      await browser?.close();
    } catch {
      /* already gone */
    }
    killPreviewGroup(proc);
  }

  if (unmeasured.length > 0) fail(`scene(s) not measured:\n  ${unmeasured.join('\n  ')}`);
  if (update) writeBudgets(measured);
  else checkBudgets(measured);
  process.exit(0);
}

function parseArgs(argv) {
  const opts = { update: false, scene: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--update') opts.update = true;
    else if (argv[i] === '--scene' && argv[i + 1]) opts.scene = argv[++i];
    else fail(`unknown argument: ${argv[i]}`, 2);
  }
  return opts;
}

/**
 * A capture page with the Performance toggle on before the app reads it. The app opens a 2D-rooted
 * scene in its 2D workspace, so one page serves both.
 */
async function profiledPage(browser) {
  const context = await createCaptureContext(browser, { frameOnOpen: true });
  await context.addInitScript(
    ([key, value]) => window.localStorage.setItem(key, value),
    [SHOW_PERFORMANCE_STORAGE_KEY, 'true']
  );
  const page = await context.newPage();
  return { page, errors: attachConsoleGate(page) };
}

/**
 * The scene's steady work per frame, or a reason it has none. Steady counts, not a settled picture,
 * end the wait: an animated scene does the same work each frame, and a frame of a large world under
 * software GL outlasts a screenshot's timeout.
 */
async function measureScene({ page, errors }, baseUrl, scene) {
  errors.length = 0;
  await gotoFixture(page, baseUrl, scene.file, (ms) =>
    console.log(`[perf]   ${scene.name}: no network idle within ${ms}ms`)
  );
  const { canvas, reason } = await findCanvas(page);
  if (!canvas) return { work: null, reason };
  await page.waitForTimeout(SETTLE_INITIAL_MS);
  if (!(await textureWorkCleared(page.getByTestId(TEXTURE_WORK_STATUS_TESTID)))) {
    return { work: null, reason: 'texture work still pending' };
  }
  const { work, reason: unsteady } = await steadyWork(page);
  if (errors.length > 0) return { work: null, reason: `console error(s): ${errors.join(' | ')}` };
  return { work, reason: unsteady };
}

/** The scene's work once it is steady, or a reason it never was. */
async function steadyWork(page) {
  const steady = new SteadyWork();
  let lastWindow = '';
  let lastWindowAt = Date.now();
  for (const deadline = Date.now() + MAX_STEADY_WAIT_MS; Date.now() < deadline;) {
    await page.waitForTimeout(READ_INTERVAL_MS);
    const snapshot = await readOverlay(page);
    const window = JSON.stringify(snapshot);
    if (snapshot.rows.length === 0 || window === lastWindow) continue;
    const frames = (Date.now() - lastWindowAt) / Number.parseFloat(snapshot.frameMs);
    lastWindow = window;
    lastWindowAt = Date.now();
    const work = steady.observe(parseWorkCounts(snapshot), frames);
    if (work) return { work, reason: null };
  }
  return {
    work: null,
    reason: `work never steady within ${MAX_STEADY_WAIT_MS} ms, last window ${lastWindow}`,
  };
}

/** The overlay's frame interval, draws total and each step row's cells. The capture paints it out, so it reads text. */
function readOverlay(page) {
  return page.evaluate(({ overlay, frameMs, drawCalls }) => {
    const panel = document.querySelector(`[data-testid="${overlay}"]`);
    return {
      frameMs: panel?.querySelector(`[data-testid="${frameMs}"]`)?.textContent ?? '',
      drawCalls: panel?.querySelector(`[data-testid="${drawCalls}"]`)?.textContent ?? '',
      rows: [...(panel?.querySelectorAll('tbody tr') ?? [])].map((row) =>
        [...row.children].map((cell) => cell.textContent ?? '')
      ),
    };
  }, PERFORMANCE_TESTIDS);
}

function checkBudgets(measured) {
  const budgets = JSON.parse(readFileSync(BUDGETS_PATH, 'utf8'));
  let overrunScenes = 0;
  for (const [name, work] of Object.entries(measured)) {
    const budget = budgets[name];
    if (!budget) {
      console.error(`[perf] ${name}: no budget. Run pnpm test:perf:update and commit budgets.json.`);
      overrunScenes += 1;
      continue;
    }
    const { overruns, slack } = compareToBudget(work, budget);
    for (const line of overruns) console.error(`[perf] ${name} over budget: ${line}`);
    for (const line of slack) console.log(`[perf] ${name} under budget: ${line}`);
    if (overruns.length > 0) overrunScenes += 1;
  }
  if (overrunScenes > 0) {
    fail(
      `${overrunScenes} scene(s) over budget. Fix the extra work, or, when it is intended, run ` +
        'pnpm test:perf:update and say why in the pull request.'
    );
  }
  console.log(`[perf] PASS: ${Object.keys(measured).length} scene(s) within budget.`);
}

/** Writes the measured work over the budgets of the scenes this run measured, and keeps the rest. */
function writeBudgets(measured) {
  const budgets = { ...JSON.parse(readFileSync(BUDGETS_PATH, 'utf8')), ...measured };
  const ordered = Object.fromEntries(BUDGET_SCENES.map(({ name }) => [name, budgets[name]]));
  writeFileSync(BUDGETS_PATH, `${JSON.stringify(ordered, null, 2)}\n`);
  console.log(
    `[perf] ${Object.keys(measured).length} budget(s) written to ${BUDGETS_PATH}. Review, then commit.`
  );
}

function fail(message, code = 1) {
  console.error(`[perf] ${message}`);
  process.exit(code);
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  await main();
}
