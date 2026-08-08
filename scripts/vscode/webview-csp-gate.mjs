#!/usr/bin/env node
/**
 * End-to-end gate: Control text paints inside the REAL VS Code webview, under
 * the production CSP, with nothing fetched.
 *
 * `webviewHtml.ts` serves the preview with `default-src 'none'` and no
 * `connect-src`, `worker-src` or `font-src`. That is why the renderer paints
 * every glyph through a vendored MSDF atlas riding `img-src … data:` rather
 * than through a font library that would fetch its own font and spawn a
 * blob-URL worker (ADR-0031). The extension-host integration suite cannot see
 * that: a webview is a sandboxed `vscode-webview://` frame, so the suite proves
 * the panel loads and hands over its payload, never that a pixel landed. This
 * gate drives a real desktop VS Code — the build `@vscode/test-electron`
 * downloads — opens the preview through the extension's own contributed
 * command, and reads the canvas back over CDP.
 *
 *   pnpm test:vscode:csp                run the gate (builds the extension first)
 *   pnpm test:vscode:csp --skip-build   reuse the current dist/
 *   pnpm test:vscode:csp --verbose      stream VS Code's stdout/stderr
 *
 * It rebuilds `apps/textscene-vscode/dist/`, so it must not run alongside
 * `pnpm validate` or any other build of that package — `--skip-build` runs it
 * against a bundle you already trust. A build that lands between the two runs
 * below would have them capture different code, which is the one thing the pair
 * cannot survive, so the bundle's mtime is asserted unchanged across them.
 *
 * Two scenes, one launch each:
 *   - the Control label fixture, which must produce at least INK_FLOOR ink
 *     pixels in the canvas readback;
 *   - its text-free twin, derived from that same file at run time, which must
 *     produce exactly zero.
 *
 * The pair is what makes the assertion mean "glyphs painted" rather than
 * "something painted": the two scenes differ in nothing but whether a glyph is
 * asked for, so an empty canvas cannot pass the first and a canvas that paints
 * chrome or a background cannot pass the second.
 *
 * Linux/Xvfb only — see the CI notes in `.github/workflows/ci.yml`.
 */
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import {
  assertExtensionBuilt,
  driveScene,
  REPO_ROOT,
  resolveVscodeBinary,
} from './driveScene.mjs';
import { blankSceneText } from './sceneText.mjs';

/** The Control fixture whose only ink is text. */
const FIXTURE = 'scenes/fixtures/unit-label-2d.tscn';

/**
 * Ink floor for the label scene's canvas readback.
 *
 * Deliberately far below what a passing run produces, because the count scales
 * with the canvas and the canvas scales with the virtual display the driver
 * happens to get: on a 640x480 Xvfb screen the preview shares the editor area
 * with the source document, leaving a 235x357 canvas and 252 ink pixels, and a
 * roomier display only raises that. Nothing is gained by tracking the number —
 * the failure being guarded (the glyph atlas blocked, so no glyph paints at all)
 * takes it to zero on any display, and the text-free twin asserting exactly 0 is
 * what makes a non-zero count here attributable to text rather than to chrome.
 */
const INK_FLOOR = 100;

const OUT_ROOT = path.join(REPO_ROOT, 'scripts/vscode/output/csp-gate');
const BASE_PORT = 9464;

// ============================================================================
// Args
// ============================================================================

function parseArgs(argv) {
  const opts = { skipBuild: false, verbose: false, headed: false };
  for (const arg of argv) {
    switch (arg) {
      case '--skip-build': opts.skipBuild = true; break;
      case '--verbose': opts.verbose = true; break;
      case '--headed': opts.headed = true; break;
      default: throw new Error(`Unknown option: ${arg}`);
    }
  }
  return opts;
}

// ============================================================================
// Scenes
// ============================================================================

/**
 * Lays out the throwaway workspace the two runs open: the fixture verbatim and
 * its text-free twin, side by side so both resolve `res://` against the same
 * folder.
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

  return { workspace, withText, withoutText, replacements };
}

// ============================================================================
// Assertions
// ============================================================================

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
 * message — several hundred kilobytes of it, which buries every other failure.
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
      webview.cspViolations.slice(0, 3).map((entry) => brief(entry.text ?? entry)).join(' | ')
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
      webview.consoleErrors.slice(0, 3).map((entry) => brief(entry.text)).join(' | ')
  );
  gate.check(
    webview.offendingHosts.length === 0,
    `${where} the preview talked to ${webview.offendingHosts.join(', ')} — it must load ` +
      'everything from VS Code\'s local resource origin and the bundle itself'
  );
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  const opts = parseArgs(process.argv.slice(2));

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
  const bundleStamp = statSync(bundle).mtimeMs;
  const { workspace, withText, withoutText, replacements } = prepareScenes();
  console.log(`[gate] VS Code:   ${binary}`);
  console.log(`[gate] workspace: ${workspace}`);
  console.log(`[gate] control:   blanked ${replacements} text assignment(s)`);

  const runs = [
    { label: 'with-text', scene: withText },
    { label: 'without-text', scene: withoutText },
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
      // The canvas settles on a signal (two identical readbacks), so there is
      // no fixed wait to tune, and the layout commands the CLI runs to widen
      // the window for a screenshot are skipped: each is a fuzzy palette match
      // that could invoke something else, and readback ink does not depend on
      // how wide the editor area is.
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
      // Kept for failure triage — CI uploads them.
      screenshots: true,
      headed: opts.headed,
      keepOpen: 0,
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

  console.log('\n[gate] canvas readback');
  console.log(
    `  with-text     ${withInk.width}x${withInk.height}  ink=${withInk.inkPixels}` +
      `  opaque=${withInk.nonTransparentPixels}`
  );
  console.log(
    `  without-text  ${withoutInk.width}x${withoutInk.height}  ink=${withoutInk.inkPixels}` +
      `  opaque=${withoutInk.nonTransparentPixels}`
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
  console.log('\n[gate] PASSED — glyphs paint in the real webview, offline, under the real CSP');
}

await main();
