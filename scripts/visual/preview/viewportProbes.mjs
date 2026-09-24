/**
 * Asks the running app which workspace it opened a scene in and where its 2D comparison frame is,
 * and drives its display toggles. This knowledge lives in one place: a second copy would not fail
 * when the app changes, it would measure the wrong pixels.
 */

import { CANVAS_2D_TESTIDS } from './appContract.mjs';

/**
 * Sets one of the viewport's display toggles through the real UI. It waits for attached, not
 * visible, and uses `dispatchEvent`, not `click()`: the capture context hides the toolbar with
 * `display: none`, and Playwright refuses to click a hidden target. Returns null on success, or a
 * reason for the caller to fail with.
 */
export async function setDisplayToggle(page, label, wanted) {
  const popover = page.locator('[data-testid="display-menu-popover"]');
  // Idempotent: a scene may ask for two toggles, and a second click would shut the menu.
  if ((await popover.count()) === 0) {
    const button = page.locator('[data-testid="display-menu-button"]');
    try {
      await button.waitFor({ state: 'attached', timeout: 10000 });
    } catch {
      return 'Display menu button not found in the toolbar';
    }
    await button.dispatchEvent('click');
    await popover.waitFor({ state: 'attached', timeout: 10000 });
  }
  // By testid, so a re-layout fails on a missing node instead of matching a different label.
  const toggle = page.locator(`[data-testid="display-toggle-${label}"]`);
  try {
    await toggle.waitFor({ state: 'attached', timeout: 10000 });
  } catch {
    return `${label} toggle not found in the Display menu`;
  }
  if ((await toggle.isChecked()) !== wanted) await toggle.dispatchEvent('click');
  return null;
}

/** Which workspace the app opened the scene in, asked of the app, not re-derived. */
export async function readViewportMode(page) {
  const stage = page.locator(`[data-testid="${CANVAS_2D_TESTIDS.stage}"]`);
  return (await stage.count()) > 0 ? '2d' : '3d';
}

/**
 * The 2D comparison frame inside the stage, or a reason it cannot be captured. Each failure still
 * gives a plausible image: a stage too small clips the frame and lets the shell's chrome in, and a
 * fractional origin resamples every pixel against a reference rendered on the integer grid.
 */
export async function findCanvas2DFrame(page) {
  const stage = page.locator(`[data-testid="${CANVAS_2D_TESTIDS.stage}"]`);
  const frame = page.locator(`[data-testid="${CANVAS_2D_TESTIDS.captureFrame}"]`);
  try {
    await frame.waitFor({ timeout: 30000 });
  } catch {
    return { frame: null, reason: 'the 2D stage never mounted — the app opened this scene in 3D' };
  }
  const box = await frame.boundingBox();
  const stageBox = await stage.boundingBox();
  if (!box || !stageBox) return { frame: null, reason: '2D stage frame has no layout box' };
  // The frame's size comes from the stage, not a constant: the rect is the scene's
  // `display/window/size/viewport_*`, which is not always 1152x648.
  const declared = await frame.getAttribute('data-viewport-size');
  const [width, height] = (declared ?? '').split('x').map(Number);
  if (!Number.isFinite(width) || !Number.isFinite(height)) {
    return {
      frame: null,
      reason: `2D frame declares no usable viewport size (data-viewport-size=${declared})`,
    };
  }
  // Zoom 1 is the goal, not the rule: Godot's 2D editor zooms to fit a project rect larger than the
  // window (`games/godot-open-rts` is 1920x1080). The frame holds the project's rect at one scale
  // on both axes, and never magnified, which would resample it against a 1:1 reference.
  const scale = box.width / width;
  if (scale > 1.001 || Math.abs(box.height / height - scale) > 0.002) {
    return {
      frame: null,
      reason:
        `2D frame is ${box.width}x${box.height} for a ${width}x${height} viewport — ` +
        'not the project rect at a uniform scale of 1 or less',
    };
  }
  if (!Number.isInteger(box.x) || !Number.isInteger(box.y)) {
    return { frame: null, reason: `2D frame origin ${box.x},${box.y} is not on a whole pixel` };
  }
  if (
    box.x < stageBox.x ||
    box.y < stageBox.y ||
    box.x + box.width > stageBox.x + stageBox.width ||
    box.y + box.height > stageBox.y + stageBox.height
  ) {
    return {
      frame: null,
      reason:
        `2D frame ${width}x${height} does not fit the ` +
        `${stageBox.width}x${stageBox.height} stage — widen the capture viewport`,
    };
  }
  return { frame, reason: null };
}
