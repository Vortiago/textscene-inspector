/**
 * The browser's Pointer Lock, as toggled freelook uses it: the pointer hides and each
 * `pointermove` reports its motion in `movementX` and `movementY`. A browser fact, so it sits
 * outside `godotEditorCursor.ts`, as `pointerGesture.ts` does.
 */

export function holdsPointerLock(element: Element): boolean {
  return element.ownerDocument.pointerLockElement === element;
}

/**
 * Asks for the lock. The browser answers through `pointerlockchange`, so the caller learns of a
 * grant there and nowhere else.
 */
export function requestPointerLock(element: Element): void {
  // Chromium returns a promise and other engines return nothing. Chromium refuses a request with
  // no user gesture, or one sent about a second after Escape ended the last lock.
  Promise.resolve(element.requestPointerLock?.()).catch(() => {
    /* A refused lock fires no change event, so freelook stays off. */
  });
}

export function exitPointerLock(element: Element): void {
  if (holdsPointerLock(element)) element.ownerDocument.exitPointerLock();
}
