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

/* global document, window, requestAnimationFrame, PointerEvent */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  attachDiagnostics,
  CANVAS_2D_TESTIDS,
  clearDiagnostics,
  createCaptureContext,
  errorReport,
  loggedErrors,
  openScene,
  PERFORMANCE_TESTIDS,
  previewPort,
  sceneStillLoading,
  withPreviewBrowser,
} from '../visual/previewServer.mjs';
import { BUDGET_SCENES } from './scenes.mjs';
import { SteadyWork } from './steadyWork.mjs';
import { compareToBudget, parseWorkCounts } from './workCounts.mjs';

const BUDGETS_PATH = resolve(import.meta.dirname, 'budgets.json');

/** Shorter than the overlay's 500 ms window, so no window goes unread. */
const READ_INTERVAL_MS = 250;
/** A large demo under software GL loads in tens of seconds and draws a few frames a second. */
const MAX_STEADY_WAIT_MS = 180000;

async function main() {
  const { update, scene: only } = parseArgs(process.argv.slice(2));
  const scenes = only ? BUDGET_SCENES.filter((s) => s.name === only) : BUDGET_SCENES;
  if (scenes.length === 0) {
    fail(`no budget scene named "${only}". Known: ${BUDGET_SCENES.map((s) => s.name).join(', ')}`, 2);
  }

  const measured = {};
  const unmeasured = [];
  await withPreviewBrowser(previewPort('perf'), async (browser, baseUrl) => {
    const pages = new ProfiledPages(browser);
    for (const scene of scenes) {
      const { work, reason } = await measureScene(await pages.for(scene), baseUrl, scene);
      if (work) measured[scene.name] = work;
      else unmeasured.push(`${scene.name}: ${reason}`);
      console.log(`[perf] ${scene.name} ${work ? `${work.drawCalls} draw calls` : 'not measured'}`);
    }
  });

  if (unmeasured.length > 0) fail(`scene(s) not measured:\n  ${unmeasured.join('\n  ')}`);
  if (update) writeBudgets(measured);
  else checkBudgets(measured);
  process.exit(0);
}

/** Parses `--update` and `--scene <name>`. Anything else is a usage error (exit 2). */
function parseArgs(argv) {
  const opts = { update: false, scene: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--update') opts.update = true;
    else if (argv[i] === '--scene') opts.scene = argv[++i] || fail('--scene needs a scene name', 2);
    else fail(`unknown argument: ${argv[i]}`, 2);
  }
  return opts;
}

/** Profiled pages: the editor's serves 2D and 3D scenes, and an In-game scene needs one of its window. */
class ProfiledPages {
  constructor(browser) {
    this.browser = browser;
    this.pages = new Map();
  }

  for({ inGameFrame = null }) {
    const key = inGameFrame ? `in-game:${inGameFrame.width}x${inGameFrame.height}` : 'editor';
    if (!this.pages.has(key)) {
      // A failed open is forgotten, so the next scene of this key tries again and shows its own cause.
      const opened = this.open(inGameFrame);
      opened.catch(() => this.pages.delete(key));
      this.pages.set(key, opened);
    }
    return this.pages.get(key);
  }

  async open(inGameFrame) {
    const context = await createCaptureContext(this.browser, {
      frameOnOpen: !inGameFrame,
      showPerformance: true,
      inGameFrame,
    });
    const page = await context.newPage();
    return { page, diagnostics: attachDiagnostics(page) };
  }
}

/**
 * The scene's steady work per frame, or a reason it has none. Steady counts, not a settled picture,
 * end the wait: an animated scene does the same work each frame, and a frame of a large world under
 * software GL outlasts a screenshot's timeout.
 */
async function measureScene({ page, diagnostics }, baseUrl, scene) {
  clearDiagnostics(diagnostics);
  const { target, reason } = await openScene(page, baseUrl, scene.file, {
    onSlow: (ms) => console.log(`[perf]   ${scene.name}: no network idle within ${ms}ms`),
  });
  if (!target) return { work: null, reason };
  const loading = await sceneStillLoading(page);
  if (loading) return { work: null, reason: loading };
  if (scene.writesEachFrame) await startWritesEachFrame(page, scene.writesEachFrame);
  if (scene.pansCamera) await startPanning(page);
  const { work, reason: unsteady } = await steadyWork(page);
  if (loggedErrors(diagnostics).length > 0) {
    return { work: null, reason: `console error(s): ${errorReport(diagnostics)}` };
  }
  return { work, reason: unsteady };
}

/** Writes the position of `count` children of `parent` on every frame, as a host's code would. */
async function startWritesEachFrame(page, { parent, count }) {
  await page.waitForFunction(() => window.textscene !== undefined);
  await page.evaluate(
    ({ parentPath, writes }) => {
      const { scene, variant } = window.textscene;
      const children = scene.getNode(parentPath).getChildren();
      let frame = 0;
      const writeFrame = () => {
        frame += 1;
        for (let i = 0; i < writes; i++) {
          const node = children[i % children.length];
          void node.set(
            'position',
            variant(`Vector3(${i % 10}, ${(frame % 60) / 30}, ${Math.floor(i / 10)})`)
          );
        }
        requestAnimationFrame(writeFrame);
      };
      requestAnimationFrame(writeFrame);
    },
    { parentPath: parent, writes: count }
  );
}

/** One pixel right and back each frame: every item stays on screen, so the draws stay steady. */
async function startPanning(page) {
  await page.evaluate((stageTestId) => {
    const stage = document.querySelector(`[data-testid="${stageTestId}"]`);
    const { left, top, width, height } = stage.getBoundingClientRect();
    const y = top + height / 2;
    const pointer = (type, x) =>
      stage.dispatchEvent(
        new PointerEvent(type, {
          bubbles: true,
          clientX: x,
          clientY: y,
          button: 0,
          buttons: 1,
          pointerId: 1,
          pointerType: 'mouse',
          isPrimary: true,
        })
      );
    const x = left + width / 2;
    pointer('pointerdown', x);
    let frame = 0;
    const move = () => {
      frame += 1;
      pointer('pointermove', x + (frame % 2));
      requestAnimationFrame(move);
    };
    requestAnimationFrame(move);
  }, CANVAS_2D_TESTIDS.stage);
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
    if (work) {
      console.log(`[perf]   frame interval ${snapshot.frameMs}`);
      return { work, reason: null };
    }
  }
  return {
    work: null,
    reason: `work never steady within ${MAX_STEADY_WAIT_MS} ms, last window ${lastWindow}`,
  };
}

/** Reads the overlay's text, since the capture paints the overlay out. */
function readOverlay(page) {
  return page.evaluate(({ overlay, frameMs, drawCalls, sceneRenders }) => {
    const panel = document.querySelector(`[data-testid="${overlay}"]`);
    return {
      frameMs: panel?.querySelector(`[data-testid="${frameMs}"]`)?.textContent ?? '',
      drawCalls: panel?.querySelector(`[data-testid="${drawCalls}"]`)?.textContent ?? '',
      sceneRenders: panel?.querySelector(`[data-testid="${sceneRenders}"]`)?.textContent ?? '',
      rows: [...(panel?.querySelectorAll('tbody tr') ?? [])].map((row) =>
        [...row.children].map((cell) => cell.textContent ?? '')
      ),
    };
  }, PERFORMANCE_TESTIDS);
}

function checkBudgets(measured) {
  const budgets = readBudgets();
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
  const budgets = { ...readBudgets(), ...measured };
  const ordered = Object.fromEntries(BUDGET_SCENES.map(({ name }) => [name, budgets[name]]));
  writeFileSync(BUDGETS_PATH, `${JSON.stringify(ordered, null, 2)}\n`);
  console.log(
    `[perf] ${Object.keys(measured).length} budget(s) written to ${BUDGETS_PATH}. Review, then commit.`
  );
}

function readBudgets() {
  return JSON.parse(readFileSync(BUDGETS_PATH, 'utf8'));
}

function fail(message, code = 1) {
  console.error(`[perf] ${message}`);
  process.exit(code);
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  await main();
}
