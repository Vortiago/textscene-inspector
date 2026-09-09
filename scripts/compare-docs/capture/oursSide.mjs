/** Our side: one build, one preview server, one browser, serially over every fixture. */

import {existsSync, mkdirSync } from 'node:fs';
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
import { resolveModes } from './modes.mjs';
import { IMAGES, imagePath } from './paths.mjs';

// Distinct from both the golden harness (4317) and the single-shot parity
// capture (4319), so a long batch run cannot collide with either.
const PORT = Number(process.env.COMPARE_PORT) || 4321;

export async function captureOurs(fixtures, force, godotModes) {
  mkdirSync(IMAGES, { recursive: true });
  const pending = fixtures.filter((f) => force || !existsSync(imagePath(f, 'ours')));
  if (pending.length === 0) {
    console.log('[ours] nothing to capture');
    return [];
  }

  const { modes, unknown } = resolveModes(pending, godotModes);
  const failures = unknown.map((fixture) => ({
    fixture,
    error: 'no reference render to take the 2D/3D mode from — capture --godot first',
  }));
  const capturable = pending.filter((f) => modes.has(f));
  if (capturable.length === 0) return failures;

  ensureWebBuilt();
  await assertPortFree(PORT, 'COMPARE_PORT');
  const { proc, baseUrl } = startPreview(PORT);
  let browser;
  try {
    await waitForServer(`${baseUrl}/`);
    browser = await chromium.launch({ headless: true, args: SWIFTSHADER_GL_ARGS });
    // Burn the first-WebGL-context-lost risk before any published image is
    // captured — see warmUpGLContext's own doc comment.
    await warmUpGLContext(browser);

    // One context per workspace, not per fixture: the two need different
    // browser viewports and different seeded preferences, and a context is far
    // more expensive than the navigation it hosts.
    let done = 0;
    for (const mode of ['3d', '2d']) {
      const group = capturable.filter((f) => modes.get(f) === mode);
      if (group.length === 0) continue;
      // 3D: Godot's editor camera, matching the reference side. 2D: the project
      // viewport rectangle at zoom 1, with the stage's chrome painted out.
      const context = await createCaptureContext(browser, {
        frameOnOpen: false,
        canvas2D: mode === '2d',
      });
      const page = await context.newPage();
      try {
        for (const fixture of group) {
          process.stdout.write(`[ours] ${++done}/${capturable.length} ${fixture} (${mode}) … `);
          try {
            await gotoFixture(page, baseUrl, fixture);
            const { target, reason: targetReason } = await findCaptureTarget(page, {
              canvas2D: mode === '2d',
            });
            if (!target) throw new Error(targetReason);
            const { buffer, reason } = await settleCanvas(page, target);
            if (!buffer) throw new Error(reason);
            // Asked once the frame has settled, not before: the workspace claim
            // is re-derived as a scene's sub-resources land, so a page read
            // early enough can still be showing the 3D default.
            const opened = await readViewportMode(page);
            if (opened !== mode) {
              throw new Error(
                `the previewer opened this scene in ${opened.toUpperCase()} but Godot rendered ` +
                  `it as ${mode.toUpperCase()} — the two frames are not comparable`
              );
            }
            writeCaptureImage(imagePath(fixture, 'ours'), buffer, `${fixture} ours`);
            console.log('ok');
          } catch (error) {
            console.log(`FAILED: ${error.message}`);
            failures.push({ fixture, error: error.message });
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
