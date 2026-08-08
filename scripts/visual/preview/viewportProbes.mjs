/**
 * Asking the running app about itself: which workspace it opened a scene in,
 * where its 2D comparison frame is, and driving its display toggles.
 *
 * App-structure knowledge lives here rather than at the call site for the
 * reason this family exists: a second copy does not fail when the app changes,
 * it silently measures the wrong pixels.
 */

import { CANVAS_2D_TESTIDS } from './appContract.mjs';

/**
 * Set one of the viewport's display toggles, driving the real UI.
 *
 * The toggles moved behind a menu once already.
 *
 * ATTACHED, not visible, and `dispatchEvent` rather than `click()`: the capture
 * context paints the whole toolbar overlay out with `display: none` so it
 * cannot composite into `canvas.screenshot()`. The controls are fully
 * functional, just unpainted, and Playwright refuses to click a hidden target.
 *
 * Returns null on success, or a reason string for the caller to fail with.
 */
export async function setDisplayToggle(page, label, wanted) {
  const popover = page.locator('[data-testid="display-menu-popover"]');
  // Idempotent: a scene may ask for two toggles, and a second click would shut
  // the menu again.
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
  // By testid, so a re-layout fails loudly on a missing node instead of
  // quietly substring-matching a different label.
  const toggle = page.locator(`[data-testid="display-toggle-${label}"]`);
  try {
    await toggle.waitFor({ state: 'attached', timeout: 10000 });
  } catch {
    return `${label} toggle not found in the Display menu`;
  }
  if ((await toggle.isChecked()) !== wanted) await toggle.dispatchEvent('click');
  return null;
}

/** Which workspace the app itself opened the scene in — its own decision, asked, not re-derived. */
export async function readViewportMode(page) {
  const stage = page.locator(`[data-testid="${CANVAS_2D_TESTIDS.stage}"]`);
  return (await stage.count()) > 0 ? '2d' : '3d';
}

/**
 * The 2D comparison frame: the project-viewport rectangle inside the stage, or
 * a reason it cannot be captured. Checked rather than assumed, because every
 * way this goes wrong produces an image that still looks plausible — a stage
 * too small to hold the frame at zoom 1 clips it (the shell's chrome creeps in
 * at the edges), and a fractional origin resamples every pixel of the scene
 * against a reference that was rendered on the integer grid.
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
  // What the frame IS, from the stage itself, rather than a constant here: the
  // rect is the scene's `display/window/size/viewport_*`, so 23 of the corpus's
  // projects are not 1152x648. The invariant this guards is still zoom 1 — the
  // frame's laid-out box must equal its own declared size.
  const declared = await frame.getAttribute('data-viewport-size');
  const [width, height] = (declared ?? '').split('x').map(Number);
  if (!Number.isFinite(width) || !Number.isFinite(height)) {
    return {
      frame: null,
      reason: `2D frame declares no usable viewport size (data-viewport-size=${declared})`,
    };
  }
  // Zoom 1 is the goal, not the rule. Godot's own 2D editor zooms to fit a
  // project rect larger than the window, and `games/godot-open-rts` is
  // 1920x1080 against a stage of about 950x750 — so a fixed zoom-1 assumption
  // is OURS, not Godot's, and would report a working capture as broken. What
  // must hold is that the frame is the project's rect at a UNIFORM scale: both
  // axes at the same factor, and never magnified (which would resample the
  // scene up and compare it against a reference rendered at 1:1).
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
