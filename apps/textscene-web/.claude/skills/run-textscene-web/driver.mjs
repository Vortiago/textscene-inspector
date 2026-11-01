#!/usr/bin/env node
/**
 * Drives the built web previewer in headless Chromium for one scene: it opens a fixture, can
 * upload files over it, selects outliner nodes, and writes screenshots and a JSON report. It
 * composes the web gate's helpers, so it serves, settles and captures exactly as the gates do.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, extname, join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import {
  attachDiagnostics,
  findCanvas,
  gotoFixture,
  previewPort,
  readViewportMode,
  settleCanvas,
  VIEWPORT,
  withPreviewBrowser,
  writeCaptureImage,
} from '../../../../../scripts/visual/previewServer.mjs';
import { inkStats } from '../../../../../scripts/vscode/pixels.mjs';
import {
  expandAllTreeRows,
  readOutlinerPaths,
  selectOutlinerNode,
} from '../../../../../scripts/e2e/outliner.mjs';
import { readInspectorPanel } from '../../../../../scripts/e2e/inspector.mjs';

const USAGE = `usage: driver.mjs <fixture.tscn> [--upload <file>]... [--select <nodePath>]...
                  [--camera <Camera3D path>] [--eval <js expression>] [--out <dir>]`;

// A selection re-renders synchronously off React state, so a fixed wait suffices, as in the web gate.
const SELECT_SETTLE_MS = 400;

const MIME_TYPES = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
};

function parseCli(argv) {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      upload: { type: 'string', multiple: true, default: [] },
      select: { type: 'string', multiple: true, default: [] },
      camera: { type: 'string' },
      eval: { type: 'string' },
      // Outside the worktree, so a run leaves no untracked file.
      out: { type: 'string', default: join(tmpdir(), 'run-textscene-web') },
    },
  });
  if (positionals.length !== 1)
    throw new Error(`expected one fixture name, got ${positionals.length}\n${USAGE}`);
  return { fixture: positionals[0], ...values, out: resolve(values.out) };
}

/** A local file as the payload `setInputFiles` takes. The toolbar sorts scenes from resources by extension. */
function uploadPayload(path) {
  const mimeType = MIME_TYPES[extname(path).toLowerCase()] ?? 'text/plain';
  return { name: basename(path), mimeType, buffer: readFileSync(path) };
}

async function uploadFiles(page, paths) {
  await page.getByTestId('upload-tscn-input').setInputFiles(paths.map(uploadPayload));
  await page.getByTestId('uploaded-tscn-label').waitFor();
}

/**
 * Settles the scene's WebGL canvas and writes it, or answers why there is no frame. The canvas, not
 * the 2D parity frame: that frame refuses a stage whose origin is off the whole-pixel grid, which
 * the app's default layout puts it on.
 */
async function captureScene(page, out) {
  const stage = await readViewportMode(page);
  const { canvas, reason } = await findCanvas(page);
  if (!canvas) return { stage, reason };
  const settled = await settleCanvas(page, canvas);
  if (!settled.buffer) return { stage, reason: settled.reason };
  writeCaptureImage(join(out, 'canvas.png'), settled.buffer, 'canvas');
  return { stage, ink: inkStats(settled.buffer), reason: null };
}

async function inspectSelections(page, nodePaths, out) {
  const selections = [];
  for (const [index, nodePath] of nodePaths.entries()) {
    await selectOutlinerNode(page, nodePath);
    await page.waitForTimeout(SELECT_SETTLE_MS);
    const shot = `select-${index + 1}.png`;
    await page.screenshot({ path: join(out, shot) });
    selections.push({ nodePath, screenshot: shot, inspector: await readInspectorPanel(page) });
  }
  return selections;
}

async function drive(browser, baseUrl, cli) {
  const context = await browser.newContext({ viewport: VIEWPORT });
  const page = await context.newPage();
  const diagnostics = attachDiagnostics(page);
  try {
    await gotoFixture(page, baseUrl, cli.fixture, () => {}, { camera: cli.camera });
    if (cli.upload.length > 0) await uploadFiles(page, cli.upload);
    const capture = await captureScene(page, cli.out);
    await expandAllTreeRows(page);
    const outline = await readOutlinerPaths(page);
    await page.screenshot({ path: join(cli.out, 'page.png') });
    const selections = await inspectSelections(page, cli.select, cli.out);
    const evaluated = cli.eval === undefined ? undefined : await page.evaluate(cli.eval);
    return { url: page.url(), ...capture, outline, selections, eval: evaluated, diagnostics };
  } finally {
    await context.close();
  }
}

const cli = parseCli(process.argv.slice(2));
mkdirSync(cli.out, { recursive: true });
const report = await withPreviewBrowser(previewPort('runWeb'), (browser, baseUrl) =>
  drive(browser, baseUrl, cli)
);
writeFileSync(join(cli.out, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
