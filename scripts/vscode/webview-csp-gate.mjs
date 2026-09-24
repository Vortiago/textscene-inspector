#!/usr/bin/env node
/**
 * End-to-end gate (`pnpm test:vscode:csp`): Control text paints inside the real
 * VS Code webview, under the production CSP, with nothing fetched. Linux/Xvfb
 * only: see the CI notes in `.github/workflows/ci.yml`.
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

/**
 * The Control fixture whose only ink is text. The preview CSP (`webviewHtml.ts`)
 * is `default-src 'none'` with no `connect-src`, `worker-src` or `font-src`, so
 * glyphs come from a vendored MSDF atlas riding `img-src … data:`, not a font
 * library that fetches a font and spawns a blob-URL worker (ADR-0037).
 */
const FIXTURE = 'scenes/fixtures/unit-label-2d.tscn';

/**
 * Ink floor for the label scene, far below a passing run: the count scales with
 * the virtual display. A 640x480 Xvfb screen, shared with the source editor,
 * gives a 235x357 canvas and 252 ink pixels. A blocked glyph atlas takes the
 * count to zero on any display.
 */
const INK_FLOOR = 100;

const OUT_ROOT = path.join(REPO_ROOT, 'scripts/vscode/output/csp-gate');
const BASE_PORT = 9464;

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
  const { workspace, withText, withoutText, replacements } = prepareScenes();
  console.log(`[gate] VS Code:   ${binary}`);
  console.log(`[gate] workspace: ${workspace}`);
  console.log(`[gate] control:   blanked ${replacements} text assignment(s)`);

  // One launch each. The label fixture must paint at least INK_FLOOR ink pixels,
  // and its text-free twin exactly zero. They differ only in whether a glyph is
  // asked for, so an empty canvas fails the first and a canvas that paints
  // chrome or a background fails the second.
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
