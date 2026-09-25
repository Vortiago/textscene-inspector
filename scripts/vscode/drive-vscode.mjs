#!/usr/bin/env node
/**
 * CLI over `driveScene.mjs`: drives the real VS Code with the TextScene
 * extension loaded, screenshots the preview webview and counts its ink pixels.
 * `webview-csp-gate.mjs` (`pnpm test:vscode:csp`) is the automated gate.
 * Usage: `node scripts/vscode/drive-vscode.mjs <scene.tscn> [options]`.
 */
import { existsSync } from 'node:fs';
import path from 'node:path';
import {
  assertExtensionBuilt,
  driveScene,
  REPO_ROOT,
  resolveVscodeBinary,
} from './driveScene.mjs';

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
      // Default: scripts/vscode/output/<scene-name>.
      case '--out': opts.out = argv[++i]; break;
      // The folder to open. Default: the scene's directory.
      case '--workspace': opts.workspace = argv[++i]; break;
      // The CDP port.
      case '--port': opts.port = Number(argv[++i]); break;
      // Milliseconds to wait after the canvas settles, before the capture.
      case '--settle': opts.settle = Number(argv[++i]); break;
      // An ES module whose default export is a self-contained function. It is
      // serialised and run inside the webview frame, and its JSON result lands
      // in report.evalResult.
      case '--eval': opts.evalFile = argv[++i]; break;
      // Uses the ambient DISPLAY instead of xvfb-run.
      case '--headed': opts.headed = true; break;
      // Keeps the .tscn source editor open beside the preview. By default it
      // closes, so the webview fills the window.
      case '--split': opts.split = true; break;
      // Skips the `preserveDrawingBuffer` patch, so the canvas readback reads
      // blank. It keeps the claim in `.claude/skills/drive-vscode-extension`
      // testable.
      case '--no-preserve-buffer': opts.preserveBuffer = false; break;
      // Keeps VS Code alive this many milliseconds after the capture, to debug.
      case '--keep-open': opts.keepOpen = Number(argv[++i]); break;
      // Streams VS Code stdout and stderr.
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

/**
 * Writes `<out>/workbench.png`, `<out>/webview.png`, `<out>/canvas.png` (the
 * WebGL readback, when it succeeds) and `<out>/report.json`, and prints a
 * summary. Exits non-zero when the preview never opens or the webview frame
 * never appears.
 */
async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const scene = path.resolve(opts.scene);
  if (!existsSync(scene)) throw new Error(`Scene not found: ${scene}`);
  assertExtensionBuilt();
  // `download: false`: an interactive run fails fast rather than start a
  // multi-minute download. The gate, which must work in a fresh checkout, opts
  // into the download.
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
