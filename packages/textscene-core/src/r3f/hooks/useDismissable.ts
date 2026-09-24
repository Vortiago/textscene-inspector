/**
 * Escape and click-outside dismissal for a panel floating over the viewport, where every pixel
 * starts a camera drag. The returned ref must wrap the trigger as well as the panel: otherwise the
 * trigger's own pointerdown closes the panel and the click that follows reopens it.
 */
import { useEffect, useRef, type RefObject } from 'react';

/**
 * Open panels, so one Escape does not both dismiss an overlay and clear the selection
 * (`<EscapeDeselect>`). Listener order cannot decide it: an event dispatched at `window` runs its
 * capture and bubble listeners in registration order, so `stopPropagation` does not help there.
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

  // Attached only while open, so a closed panel costs nothing.
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
    // Capture-phase `pointerdown`, not `click`: the panel closes before the canvas starts a drag
    // from the same press.
    window.addEventListener('pointerdown', onPointerDown, { capture: true });
    return () => {
      openPanelCount -= 1;
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('pointerdown', onPointerDown, { capture: true });
    };
  }, [open]);

  return ref;
}
