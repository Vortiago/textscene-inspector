/* global document, window, requestAnimationFrame, PointerEvent, WheelEvent, KeyboardEvent */

import { CANVAS_2D_TESTIDS } from '../visual/previewServer.mjs';

// A 2D step under a pixel moves no item across the view edge, so a window of an odd frame count stays steady.
const STAGE_STEP = 1 / 1024;

/** The buttons and modifiers are those `resolveNavMode` reads, in godotEditorCursor.ts. */
export const CAMERA_GESTURES = {
  'pan-2d': { target: 'stage', step: STAGE_STEP, button: 0, moves: true },
  'zoom-2d': { target: 'stage', step: STAGE_STEP, wheels: true },
  'orbit-3d': { target: 'canvas', step: 1, button: 1, moves: true },
  'pan-3d': { target: 'canvas', step: 1, button: 1, shiftKey: true, moves: true },
  'zoom-3d': { target: 'canvas', step: 1, wheels: true },
  'freelook-3d': { target: 'canvas', step: 1, button: 2, moves: true, keys: ['KeyW', 'KeyS'] },
};

/** One step there and one back each frame keeps each window's mean steady. Null, or why it cannot start. */
export async function startCameraGesture(page, name) {
  const gesture = CAMERA_GESTURES[name];
  if (!gesture) {
    throw new Error(`expected one of ${Object.keys(CAMERA_GESTURES).join(', ')}, got "${name}"`);
  }
  const selector = gesture.target === 'stage' ? `[data-testid="${CANVAS_2D_TESTIDS.stage}"]` : 'canvas';
  const isStarted = await page.evaluate(driveEachFrame, { gesture, selector });
  return isStarted ? null : `expected ${selector} to drive ${name}, found none`;
}

/** Runs in the page. */
function driveEachFrame({ gesture, selector }) {
  const target = document.querySelector(selector);
  if (!target) return false;
  const { left, top, width, height } = target.getBoundingClientRect();
  const x = left + width / 2;
  const y = top + height / 2;
  const mouse = { bubbles: true, clientY: y, shiftKey: Boolean(gesture.shiftKey) };
  const pointer = (type, dx) =>
    target.dispatchEvent(
      new PointerEvent(type, {
        ...mouse,
        clientX: x + Math.max(dx, 0),
        movementX: dx,
        button: gesture.button,
        buttons: 1 << [0, 2, 1][gesture.button],
        pointerId: 1,
        pointerType: 'mouse',
        isPrimary: true,
      })
    );
  const key = (type, code) => window.dispatchEvent(new KeyboardEvent(type, { code, bubbles: true }));
  if (gesture.button !== undefined) pointer('pointerdown', 0);
  let frame = 0;
  const step = () => {
    frame += 1;
    const offset = frame % 2 === 0 ? gesture.step : -gesture.step;
    if (gesture.moves) pointer('pointermove', offset);
    if (gesture.wheels) {
      target.dispatchEvent(
        new WheelEvent('wheel', { ...mouse, clientX: x, deltaY: 100 * offset, cancelable: true })
      );
    }
    if (gesture.keys) {
      key('keyup', gesture.keys[frame % 2]);
      key('keydown', gesture.keys[(frame + 1) % 2]);
    }
    requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
  return true;
}

/** A notch of a mouse wheel, toward the screen: one zooms the 2D view in by a step. */
const WHEEL_NOTCH_IN = -100;

/** Zooms the 2D view in by `notches` wheel notches at its centre, one a frame. Null, or why it cannot. */
export async function zoomStageIn(page, notches) {
  const selector = `[data-testid="${CANVAS_2D_TESTIDS.stage}"]`;
  const isZoomed = await page.evaluate(wheelEachFrame, { selector, notches, deltaY: WHEEL_NOTCH_IN });
  return isZoomed ? null : `expected ${selector} to zoom in, found none`;
}

/** Runs in the page, and resolves once the last notch has landed. */
async function wheelEachFrame({ selector, notches, deltaY }) {
  const target = document.querySelector(selector);
  if (!target) return false;
  const { left, top, width, height } = target.getBoundingClientRect();
  const at = { bubbles: true, cancelable: true, clientX: left + width / 2, clientY: top + height / 2 };
  for (let notch = 0; notch < notches; notch += 1) {
    await new Promise((resolve) => requestAnimationFrame(resolve));
    target.dispatchEvent(new WheelEvent('wheel', { ...at, deltaY }));
  }
  return true;
}
