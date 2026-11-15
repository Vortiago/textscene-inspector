/**
 * The previewer's side of an animated capture: select the driver so its transport mounts,
 * pause it, then drive the scrubber to each sampled time and screenshot.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { launchGodotComparisonBrowser } from '../../showcase/browser.mjs';
import {
  createCaptureContext,
  findCaptureTarget,
  gotoFixture,
  previewPort,
  targetShooter,
  withPreviewBrowser,
} from '../../visual/previewServer.mjs';
import { FRAMES } from './clip.mjs';
import { clipDuration, pausePlayer, seekPlayer } from '../../visual/run/seekAnimation.mjs';

export function captureOurFrames(fixture, framesDir, mode, driverText) {
  return withPreviewBrowser(
    { ...previewPort('compareAnimation'), launchBrowser: launchGodotComparisonBrowser },
    async (browser, baseUrl) => {
      const context = await createCaptureContext(browser, { frameOnOpen: false, canvas2D: mode === '2d' });
      const page = await context.newPage();
      await gotoFixture(page, baseUrl, fixture);
      await page.waitForTimeout(500);

      // The Animation tab and its transport mount only while the driver is selected (ADR-0012): the
      // AnimationPlayer (3D) or the AnimatedSprite2D (2D). The driver is a transform-only node at
      // the origin (3D) or the centred sprite (2D), so selecting it draws no selection box.
      await page
        .locator('[aria-label="Expand all"]')
        .click()
        .catch(() => {});
      await page.waitForTimeout(300);
      await page.locator(`[role="treeitem"]:has-text("${driverText}")`).first().click();
      await page.waitForTimeout(500);

      // The frame screenshotted each step: the 3D canvas, or the 2D
      // project-viewport capture frame (exactly the project rectangle).
      const { target, reason: targetReason } = await findCaptureTarget(page, { canvas2D: mode === '2d' });
      if (!target) throw new Error(targetReason ?? 'no capture target after selecting the driver');

      const duration = await clipDuration(page);
      await pausePlayer(page);

      await mkdir(framesDir, { recursive: true });
      const { shoot } = targetShooter(target);
      for (let i = 0; i < FRAMES; i++) {
        const t = (duration * i) / FRAMES;
        await seekPlayer(page, t);
        await writeFile(join(framesDir, `frame_${String(i).padStart(2, '0')}.png`), await shoot());
      }
    }
  );
}
