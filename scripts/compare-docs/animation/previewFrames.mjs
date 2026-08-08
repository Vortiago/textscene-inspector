/**
 * Our side of an animated capture: select the driver so its transport mounts,
 * pause it, then drive the scrubber to each sampled time and screenshot.
 */

/* global document, window */ // used only inside the page.evaluate callback, which runs in the browser.

import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { SWIFTSHADER_GL_ARGS } from '../../showcase/browser.mjs';
import {
  assertPortFree,
  createCaptureContext,
  ensureWebBuilt,
  findCaptureTarget,
  gotoFixture,
  killPreviewGroup,
  startPreview,
  waitForServer,
} from '../../visual/previewServer.mjs';
import { FRAMES } from './clip.mjs';

const PORT = Number(process.env.COMPARE_PORT) || 4323;

export async function captureOurFrames(fixture, framesDir, mode, driverText) {
  ensureWebBuilt();
  await assertPortFree(PORT, 'COMPARE_PORT');
  const { proc, baseUrl } = startPreview(PORT);
  let browser;
  try {
    await waitForServer(`${baseUrl}/`);
    browser = await chromium.launch({ headless: true, args: SWIFTSHADER_GL_ARGS });
    const context = await createCaptureContext(browser, { frameOnOpen: false, canvas2D: mode === '2d' });
    const page = await context.newPage();
    await gotoFixture(page, baseUrl, fixture);
    await page.waitForTimeout(500);

    // The Animation tab (and its transport) mounts only while the driver is
    // selected (ADR-0012) — the AnimationPlayer (3D) or the AnimatedSprite2D
    // (2D). Select it, then drive the scrubber. The driver is a transform-only
    // node at the origin (3D) or the centred sprite (2D), so selecting it draws
    // no selection box into the frame.
    await page.locator('[aria-label="Expand all"]').click().catch(() => {});
    await page.waitForTimeout(300);
    await page.locator(`[role="treeitem"]:has-text("${driverText}")`).first().click();
    await page.waitForTimeout(500);

    // The frame screenshotted each step: the 3D canvas, or the 2D
    // project-viewport capture frame (exactly the project rectangle).
    const { target, reason: targetReason } = await findCaptureTarget(page, { canvas2D: mode === '2d' });
    if (!target) throw new Error(targetReason ?? 'no capture target after selecting the driver');

    const scrubber = page.locator('input[type="range"]').first();
    if ((await scrubber.count()) === 0) throw new Error('no animation scrubber after selecting the player');
    const duration = Number(await scrubber.getAttribute('max'));
    if (!Number.isFinite(duration) || duration <= 0) throw new Error(`bad scrubber max: ${duration}`);

    // Enter the PAUSED state before scrubbing. Seeking from the initial STOPPED
    // state restores the authored (rest) pose and ignores the time — only a
    // paused transport applies the seeked pose. Play then Pause is how the
    // transport reaches it; an exact-name match avoids the "Animation Player"
    // clip dropdown, whose label also contains "Play".
    await page.getByRole('button', { name: 'Play', exact: true }).click();
    await page.waitForTimeout(150);
    await page.getByRole('button', { name: 'Pause', exact: true }).click();
    await page.waitForTimeout(150);

    await mkdir(framesDir, { recursive: true });
    for (let i = 0; i < FRAMES; i++) {
      const t = (duration * i) / FRAMES;
      // The scrubber is a React-controlled input, so set through the native
      // value setter and fire input/change — .fill() does not drive onChange.
      await page.evaluate((value) => {
        const el = document.querySelector('input[type=range]');
        const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        set.call(el, String(value));
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }, t);
      await page.waitForTimeout(220);
      await target.screenshot({ path: join(framesDir, `frame_${String(i).padStart(2, '0')}.png`) });
    }
  } finally {
    await browser?.close();
    killPreviewGroup(proc);
  }
}
