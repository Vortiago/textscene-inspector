/**
 * The browser's Pointer Lock for the test DOM, which has none: a request locks at once, as a
 * browser does after a user gesture, and each change fires `pointerlockchange`. Test-only.
 */

/** The element that holds the fake lock. Written by the fake's request and exit, cleared on restore. */
let lockedElement: Element | null = null;

function setLockedElement(element: Element | null): void {
  if (lockedElement === element) return;
  lockedElement = element;
  document.dispatchEvent(new Event('pointerlockchange'));
}

/**
 * Installs the fake on `element` and its document, and returns the function that removes it. A
 * test that never installs it sees a browser that refuses every lock.
 */
export function installFakePointerLock(element: HTMLElement): () => void {
  Object.defineProperty(document, 'pointerLockElement', { configurable: true, get: () => lockedElement });
  Object.defineProperty(document, 'exitPointerLock', {
    configurable: true,
    value: () => setLockedElement(null),
  });
  Object.defineProperty(element, 'requestPointerLock', {
    configurable: true,
    value: () => {
      setLockedElement(element);
      return Promise.resolve();
    },
  });
  return () => {
    lockedElement = null;
    Reflect.deleteProperty(document, 'pointerLockElement');
    Reflect.deleteProperty(document, 'exitPointerLock');
    Reflect.deleteProperty(element, 'requestPointerLock');
  };
}

/** What the browser does on Escape, or when another window takes the pointer: it ends the lock. */
export function endFakePointerLock(): void {
  setLockedElement(null);
}
