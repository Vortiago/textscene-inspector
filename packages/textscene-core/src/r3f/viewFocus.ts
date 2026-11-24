import { useEffect } from 'react';
import { isTypingTarget } from './hooks/isTypingTarget.js';

/** node_3d_editor_plugin.cpp:1668-1676. */
function focusOnPointerEnter(element: HTMLElement): void {
  const document = element.ownerDocument;
  if (document.pointerLockElement) return;
  if (document.activeElement === element || isTypingTarget(document.activeElement)) return;
  element.focus({ preventScroll: true });
}

/** A tab index of -1 keeps the view out of the tab order. */
export function useFocusOnPointerEnter(element: HTMLElement | null): void {
  useEffect(() => {
    if (!element) return undefined;
    if (!element.hasAttribute('tabindex')) element.tabIndex = -1;
    const onPointerEnter = () => focusOnPointerEnter(element);
    element.addEventListener('pointerenter', onPointerEnter);
    return () => element.removeEventListener('pointerenter', onPointerEnter);
  }, [element]);
}

/** Godot sends a key to the focused viewport only (node_3d_editor_plugin.cpp:3604). */
export function isViewKeyEvent(event: KeyboardEvent, element: Element): boolean {
  return event.target instanceof Node && element.contains(event.target) && !isTypingTarget(event.target);
}
