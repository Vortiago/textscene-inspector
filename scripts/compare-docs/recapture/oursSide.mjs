/** Our side: one build, one preview server, one browser, one context per workspace. */

import { chromium } from 'playwright';
import { SWIFTSHADER_GL_ARGS } from '../../showcase/browser.mjs';
import {
  assertPortFree,
  createCaptureContext,
  ensureWebBuilt,
  findCaptureTarget,
  gotoFixture,
  killPreviewGroup,
  readViewportMode,
  settleCanvas,
  startPreview,
  waitForServer,
  warmUpGLContext,
  writeCaptureImage,
} from '../../visual/previewServer.mjs';
import { imgPath, modeOfExistingGodot } from './targets.mjs';

const PORT = Number(process.env.COMPARE_PORT) || 4321;

export async function captureOurs(targets, godotModes) {
  const failures = [];
  const withMode = targets
    .map((t) => ({ ...t, mode: godotModes.get(t.image) ?? modeOfExistingGodot(t.image) }))
    .filter((t) => {
      if (!t.mode) failures.push({ image: t.image, error: 'no godot render to take 2D/3D mode from — run without --ours first' });
      return t.mode;
    });
  if (!withMode.length) return failures;

  ensureWebBuilt();
  await assertPortFree(PORT, 'COMPARE_PORT');
  const { proc, baseUrl } = startPreview(PORT);
  let browser;
  try {
    await waitForServer(`${baseUrl}/`);
    browser = await chromium.launch({ headless: true, args: SWIFTSHADER_GL_ARGS });
    // Spends the first-context-lost risk before any published image.
    await warmUpGLContext(browser);
    let done = 0;
    for (const mode of ['3d', '2d']) {
      const group = withMode.filter((t) => t.mode === mode);
      if (!group.length) continue;
      const context = await createCaptureContext(browser, { frameOnOpen: false, canvas2D: mode === '2d' });
      const page = await context.newPage();
      try {
        for (const t of group) {
          process.stdout.write(`[ours] ${++done}/${withMode.length} ${t.image} (${mode}) … `);
          try {
            await gotoFixture(page, baseUrl, t.fixture, () => {}, t.camera ? { camera: t.camera } : {});
            const { target, reason } = await findCaptureTarget(page, { canvas2D: mode === '2d' });
            if (!target) throw new Error(reason);
            const { buffer, reason: settleReason } = await settleCanvas(page, target);
            if (!buffer) throw new Error(settleReason);
            const opened = await readViewportMode(page);
            if (opened !== mode) {
              throw new Error(`previewer opened ${opened.toUpperCase()} but Godot rendered ${mode.toUpperCase()}`);
            }
            writeCaptureImage(imgPath(t.image, 'ours'), buffer, `${t.image} ours`);
            console.log('ok');
          } catch (error) {
            console.log(`FAILED: ${error.message}`);
            failures.push({ image: t.image, error: error.message });
          }
        }
      } finally {
        await context.close();
      }
    }
  } finally {
    await browser?.close();
    killPreviewGroup(proc);
  }
  return failures;
}
