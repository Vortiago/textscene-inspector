/** Our side: one build, one preview server, one browser, one context per workspace. */

import { launchGodotComparisonBrowser } from '../../showcase/browser.mjs';
import {
  createCaptureContext,
  openScene,
  previewPort,
  readViewportMode,
  settleCanvas,
  withPreviewBrowser,
  writeCaptureImage,
} from '../../visual/previewServer.mjs';
import { imgPath, modeOfExistingGodot, settleTimeoutOf } from './targets.mjs';

export async function captureOurs(targets, godotModes) {
  const failures = [];
  const withMode = targets
    .map((t) => ({ ...t, mode: godotModes.get(t.image) ?? modeOfExistingGodot(t.image) }))
    .filter((t) => {
      if (!t.mode)
        failures.push({
          image: t.image,
          error: 'no godot render to take 2D/3D mode from — run without --ours first',
        });
      return t.mode;
    });
  if (!withMode.length) return failures;

  await withPreviewBrowser(
    { ...previewPort('compareDocs'), launchBrowser: launchGodotComparisonBrowser },
    async (browser, baseUrl) => {
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
              const { target, reason } = await openScene(page, baseUrl, t.fixture, {
                canvas2D: mode === '2d',
                camera: t.camera,
              });
              if (!target) throw new Error(reason);
              const { buffer, reason: settleReason } = await settleCanvas(page, target, {
                screenshotTimeout: settleTimeoutOf(t.fixture),
              });
              if (!buffer) throw new Error(settleReason);
              const opened = await readViewportMode(page);
              if (opened !== mode) {
                throw new Error(
                  `previewer opened ${opened.toUpperCase()} but Godot rendered ${mode.toUpperCase()}`
                );
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
    }
  );
  return failures;
}
