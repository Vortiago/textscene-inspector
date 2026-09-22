#!/usr/bin/env node
/**
 * CLI over `driveScene.mjs`: drive the REAL VS Code with the TextScene
 * extension loaded, screenshot the preview webview and count its ink pixels.
 *
 * Usage:
 *   node scripts/vscode/drive-vscode.mjs <scene.tscn> [options]
 *
 *   --out <dir>        output dir (default scripts/vscode/output/<scene-name>)
 *   --workspace <dir>  workspace folder to open (default: the scene's dir)
 *   --port <n>         CDP port (default 9444)
 *   --settle <ms>      wait after the canvas settles before capturing (default 6000)
 *   --eval <file.mjs>  ES module whose default export is a self-contained
 *                      function; it is serialised, run inside the webview
 *                      frame, and its JSON result lands in report.evalResult
 *   --split            keep the .tscn source editor open beside the preview
 *                      (default: close it so the webview fills the window)
 *   --no-preserve-buffer
 *                      skip the `preserveDrawingBuffer` patch (the canvas
 *                      readback then reads blank — kept so the claim in
 *                      `.claude/skills/drive-vscode-extension` stays testable)
 *   --headed           use the ambient DISPLAY instead of xvfb-run
 *   --keep-open <ms>   keep VS Code alive this long after capture (debugging)
 *   --verbose          stream VS Code stdout/stderr
 *
 * Writes `<out>/workbench.png`, `<out>/webview.png`, `<out>/canvas.png` (the
 * WebGL readback, when it succeeds) and `<out>/report.json`, and prints a
 * summary. Exits non-zero if the preview never opened or the webview frame
 * never appeared.
 *
 * The automated regression gate over the same machinery is
 * `webview-csp-gate.mjs` (`pnpm test:vscode:csp`).
 */
import { existsSync } from 'node:fs';
import path from 'node:path';
import {
  assertExtensionBuilt,
  driveScene,
  REPO_ROOT,
  resolveVscodeBinary,
} from './driveScene.mjs';

// ============================================================================
// Args
// ============================================================================

function parseArgs(argv) {
  const opts = {
    scene: undefined,
    out: undefined,
    workspace: undefined,
    port: 9444,
    settle: 6000,
    evalFile: undefined,
    headed: false,
    keepOpen: 0,
    split: false,
    preserveBuffer: true,
    verbose: false,
  };
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case '--out': opts.out = argv[++i]; break;
      case '--workspace': opts.workspace = argv[++i]; break;
      case '--port': opts.port = Number(argv[++i]); break;
      case '--settle': opts.settle = Number(argv[++i]); break;
      case '--eval': opts.evalFile = argv[++i]; break;
      case '--headed': opts.headed = true; break;
      case '--split': opts.split = true; break;
      case '--no-preserve-buffer': opts.preserveBuffer = false; break;
      case '--keep-open': opts.keepOpen = Number(argv[++i]); break;
      case '--verbose': opts.verbose = true; break;
      default:
        if (arg.startsWith('--')) throw new Error(`Unknown option: ${arg}`);
        rest.push(arg);
    }
  }
  opts.scene = rest[0];
  if (!opts.scene) throw new Error('Usage: drive-vscode.mjs <scene.tscn> [options]');
  return opts;
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const scene = path.resolve(opts.scene);
  if (!existsSync(scene)) throw new Error(`Scene not found: ${scene}`);
  assertExtensionBuilt();
  // `download: false` — an interactive run should fail fast rather than start
  // a multi-minute download; the gate, which must work in a fresh checkout,
  // opts into the download instead.
  const binary = await resolveVscodeBinary({ download: false });
  const workspace = path.resolve(opts.workspace ?? path.dirname(scene));
  const outDir = path.resolve(
    opts.out ?? path.join(REPO_ROOT, 'scripts/vscode/output', path.basename(scene, '.tscn'))
  );

  console.log(`[drive] VS Code:   ${binary}`);
  console.log(`[drive] scene:     ${scene}`);
  console.log(`[drive] workspace: ${workspace}`);
  console.log(`[drive] out:       ${outDir}`);

  let report;
  try {
    report = await driveScene({
      ...opts,
      scene,
      workspace,
      outDir,
      binary,
      prepareLayout: true,
      screenshots: true,
      log: (message) => console.log(`[drive] ${message}`),
    });
  } finally {
    // driveScene writes report.json even when it throws, so point at the
    // artifacts either way.
    if (report) printSummary(report, outDir);
    else console.log(`[drive] artifacts in ${outDir}`);
  }
}

function printSummary(report, outDir) {
  const line = (label, stats) => {
    if (!stats) return;
    if (stats.error) {
      console.log(`  ${label.padEnd(12)} ERROR ${stats.error}`);
      return;
    }
    console.log(
      `  ${label.padEnd(12)} ${stats.width}x${stats.height}  ink=${stats.inkPixels}` +
        `  opaque=${stats.nonTransparentPixels}  colors=${stats.distinctColors}` +
        `  bg=${stats.dominantColor} (${(stats.dominantShare * 100).toFixed(1)}%)`
    );
  };
  console.log('\n[drive] pixel report');
  line('canvas', report.canvasReadback);
  line('webview', report.webviewScreenshot);
  line('workbench', report.workbenchScreenshot);
  console.log(`  webview requests: ${JSON.stringify(report.requestHosts?.webview ?? {})}`);
  console.log(
    `  webview: csp-violations=${report.webview.cspViolations.length}` +
      `  failed-requests=${report.webview.failedRequests.length}` +
      `  console-errors=${report.webview.consoleErrors.length}`
  );
  console.log(
    `  page-wide: csp-violations=${report.cspViolations.length}` +
      `  failed-requests=${report.failedRequests.length}` +
      `  page-errors=${report.pageErrors.length}` +
      `  console-errors=${report.console.filter((entry) => entry.type === 'error').length}`
  );
  console.log(`[drive] artifacts in ${outDir}`);
}

await main();
