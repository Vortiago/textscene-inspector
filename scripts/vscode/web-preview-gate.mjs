#!/usr/bin/env node
/**
 * End-to-end gate (`pnpm test:vscode:web-preview`): in VS Code for the Web, a person opens
 * a local Godot project folder, opens a scene and clicks the preview button in the editor
 * title. The preview must list the scene's root node and paint its viewport. The web suite
 * (`test:web`) checks only that a preview tab opens, which VS Code shows before the
 * webview's script runs, so a preview that never starts passes it.
 */
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { open } from '@vscode/test-web';
import { chromium } from 'playwright';
import { SWIFTSHADER_GL_ARGS } from '../showcase/browser.mjs';
import { preserveWebglDrawingBuffer, stabilizeCanvas, writeCanvasPng } from './canvasReadback.mjs';
import { installFolderPicker, readFolderFiles } from './webFolder.mjs';
import {
  clickEditorTitleAction,
  findPreviewFrame,
  openExplorerFile,
  runCommand,
  trustFolderIfAsked,
  waitForWorkbench,
} from './webWorkbench.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const EXTENSION_DIR = path.join(REPO_ROOT, 'apps/textscene-vscode');

/** A real demo project: sub-scenes, glTF models, scripts and a theme, as a person's folder holds. */
const PROJECT_DIR = path.join(REPO_ROOT, 'scenes/demos/3d/squash_the_creeps');
const SCENE = 'Main.tscn';
const ROOT_NODE = 'Main';

/** The web build the browser loads and the webview it opens. `test:web` builds both. */
const REQUIRED_BUILD_OUTPUTS = ['dist/extension.web.js', 'dist/webview/webview.js'];

/** Beside `test:web`'s own server on 3000, so the two can run in one job. */
const PORT = Number(process.env.WEB_PREVIEW_PORT) || 3001;

/** The scene's tree and its glTF models arrive over the host channel well inside these. */
const PREVIEW_FRAME_TIMEOUT_MS = 30000;
const SCENE_TREE_TIMEOUT_MS = 60000;
const CANVAS_SETTLE = { timeoutMs: 30000, intervalMs: 500 };

/**
 * Ink floor for the viewport, far below a passing run: the sky, the ground and the player
 * cover most of the canvas. A preview whose scene never arrived draws only its clear colour.
 */
const INK_FLOOR = 1000;

const OUT_ROOT = path.join(REPO_ROOT, 'scripts/vscode/output/web-preview-gate');

function assertWebBuildPresent() {
  for (const built of REQUIRED_BUILD_OUTPUTS) {
    if (!existsSync(path.join(EXTENSION_DIR, built))) {
      throw new Error(`Missing ${built}. Run \`pnpm --filter textscene-inspector build:dev\` first.`);
    }
  }
}

/** Every console error the workbench and its frames log, for the failure report. */
function collectConsoleErrors(page) {
  const errors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));
  return errors;
}

async function openSceneAndPreview(page) {
  await page.goto(`http://localhost:${PORT}/`);
  await waitForWorkbench(page);
  await runCommand(page, 'File: Open Folder...');
  await trustFolderIfAsked(page);
  await openExplorerFile(page, SCENE);
  await clickEditorTitleAction(page, 'Open Preview to the Side');
}

/** The checks a started preview passes, as failure messages. Empty means it started. */
async function previewFailures(page) {
  const frame = await findPreviewFrame(page, PREVIEW_FRAME_TIMEOUT_MS);
  if (!frame) return ['no preview webview holds #r3f-root: the preview document never loaded'];

  const rootRow = frame.locator(`[data-node-path="${ROOT_NODE}"]`);
  const listed = await rootRow
    .waitFor({ timeout: SCENE_TREE_TIMEOUT_MS })
    .then(() => true)
    .catch(() => false);
  if (!listed) return [`the scene tree never listed ${ROOT_NODE}: the scene never reached the webview`];

  const { dataUrl, stable } = await stabilizeCanvas(frame, CANVAS_SETTLE);
  if (!stable) return [`the viewport never settled within ${CANVAS_SETTLE.timeoutMs} ms`];
  const ink = writeCanvasPng(dataUrl, path.join(OUT_ROOT, 'viewport.png'));
  if (ink.inkPixels < INK_FLOOR) {
    return [`expected at least ${INK_FLOOR} ink pixels in the viewport, found ${ink.inkPixels}`];
  }
  return [];
}

async function main() {
  assertWebBuildPresent();
  rmSync(OUT_ROOT, { recursive: true, force: true });
  mkdirSync(OUT_ROOT, { recursive: true });

  const server = await open({
    browserType: 'none',
    quality: 'stable',
    extensionDevelopmentPath: EXTENSION_DIR,
    // Shares the VS Code download with `test:web`.
    testRunnerDataDir: path.join(EXTENSION_DIR, '.vscode-test-web'),
    port: PORT,
  });
  const browser = await chromium.launch({ headless: true, args: SWIFTSHADER_GL_ARGS });
  let failures;
  try {
    const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
    await context.addInitScript(preserveWebglDrawingBuffer);
    await context.addInitScript(installFolderPicker, {
      name: path.basename(PROJECT_DIR),
      files: readFolderFiles(PROJECT_DIR),
    });
    const page = await context.newPage();
    const consoleErrors = collectConsoleErrors(page);
    // A step that times out is a failure too, so it still leaves the screenshot below.
    failures = await openSceneAndPreview(page)
      .then(() => previewFailures(page))
      .catch((error) => [`a workbench step failed: ${error.message}`]);
    await page.screenshot({ path: path.join(OUT_ROOT, 'workbench.png') });
    writeFileSync(path.join(OUT_ROOT, 'console-errors.txt'), consoleErrors.join('\n'));
    if (failures.length > 0 && consoleErrors.length > 0) {
      failures.push(`console errors:\n  ${consoleErrors.join('\n  ')}`);
    }
  } finally {
    await browser.close();
    server.dispose();
  }

  if (failures.length > 0) {
    console.error(`[web-preview] FAIL\n- ${failures.join('\n- ')}\n[web-preview] artifacts in ${OUT_ROOT}`);
    process.exit(1);
  }
  console.log(`[web-preview] PASS: ${SCENE} previewed from a local folder in VS Code for the Web`);
}

main().catch((error) => {
  console.error(`[web-preview] ${error.stack ?? error}`);
  process.exit(1);
});
