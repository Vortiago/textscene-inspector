/**
 * Escape-and-click-outside dismissal for a panel floating over the viewport.
 *
 * Both floating panels need it and both are over a surface where every pixel
 * starts a camera drag, which is what makes the details load-bearing rather
 * than boilerplate:
 *
 * - the outside listener is on the CAPTURE phase, so the panel closes before
 *   the canvas can begin navigating from the same pointerdown;
 * - it listens for `pointerdown`, not `click`, for the same reason — a click
 *   only lands after the drag would already have started;
 * - the returned ref must wrap the trigger as well as the panel. Scoping it to
 *   the panel alone would close on the trigger's own pointerdown, and the
 *   click that follows would immediately reopen it.
 *
 * Listeners are only attached while open, so a closed panel costs nothing.
 */
import { useEffect, useRef, type RefObject } from 'react';

/**
 * Every dismissable panel currently open.
 *
 * Escape is claimed by two things: dismissing the topmost overlay, and
 * clearing the scene selection (`<EscapeDeselect>`). Both listen on `window`,
 * so without arbitration one keypress does both — dismissing the controls
 * legend would silently throw away the user's selection.
 *
 * Ordering the listeners cannot decide it: `stopPropagation` from a capture
 * listener works in a browser, where the event targets an element, but not for
 * an event dispatched AT `window`, where capture and bubble listeners on that
 * same target run in registration order. An explicit registry is
 * order-independent and behaves identically in both.
 */
let openPanelCount = 0;

/**
 * True while any dismissable panel is open, so Escape belongs to it.
 * `useGlobalShortcut` consults this for every `escape` binding, so a new
 * Escape consumer cannot forget to.
 */
export function hasOpenDismissable(): boolean {
  return openPanelCount > 0;
}

export function useDismissable<T extends HTMLElement>(
  open: boolean,
  onDismiss: () => void
): RefObject<T | null> {
  const ref = useRef<T | null>(null);
  const onDismissRef = useRef(onDismiss);
  useEffect(() => {
    onDismissRef.current = onDismiss;
  }, [onDismiss]);

  useEffect(() => {
    if (!open) return;
    openPanelCount += 1;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onDismissRef.current();
    }
    function onPointerDown(event: PointerEvent) {
      if (!ref.current?.contains(event.target as Node)) onDismissRef.current();
    }
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('pointerdown', onPointerDown, { capture: true });
    return () => {
      openPanelCount -= 1;
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('pointerdown', onPointerDown, { capture: true });
    };
  }, [open]);

  return ref;
}
