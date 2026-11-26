/* global document, window, requestAnimationFrame, PointerEvent, WheelEvent, KeyboardEvent */

import { CANVAS_2D_TESTIDS } from '../visual/previewServer.mjs';

/** The buttons and modifiers are those `resolveNavMode` reads, in godotEditorCursor.ts. */
export const CAMERA_GESTURES = {
  'pan-2d': { target: 'stage', button: 0, moves: true },
  'zoom-2d': { target: 'stage', wheels: true },
  'orbit-3d': { target: 'canvas', button: 1, moves: true },
  'pan-3d': { target: 'canvas', button: 1, shiftKey: true, moves: true },
  'zoom-3d': { target: 'canvas', wheels: true },
  'freelook-3d': { target: 'canvas', button: 2, moves: true, keys: ['KeyW', 'KeyS'] },
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
    const sign = frame % 2 === 0 ? 1 : -1;
    if (gesture.moves) pointer('pointermove', sign);
    if (gesture.wheels) {
      target.dispatchEvent(
        new WheelEvent('wheel', { ...mouse, clientX: x, deltaY: 100 * sign, cancelable: true })
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
