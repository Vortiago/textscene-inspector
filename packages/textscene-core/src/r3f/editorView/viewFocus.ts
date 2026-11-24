import { useEffect } from 'react';
import { isTypingTarget } from '../hooks/isTypingTarget.js';

/** The element that holds the keys, through open shadow roots, or null while another document holds them. */
function focusedElement(document: Document): Element | null {
  if (!document.hasFocus()) return null;
  let focused = document.activeElement;
  while (focused?.shadowRoot?.activeElement) focused = focused.shadowRoot.activeElement;
  return focused;
}

/** node_3d_editor_plugin.cpp:1668-1676: no focus under a pointer lock or while a text field has it. */
function focusOnPointerEnter(element: HTMLElement): void {
  const document = element.ownerDocument;
  if (document.pointerLockElement) return;
  // Another document holds the keys, as the VS Code text editor beside the webview does.
  const focused = focusedElement(document);
  if (!focused || focused === element || isTypingTarget(focused)) return;
  element.focus({ preventScroll: true });
}

/** `FOCUS_ALL` (node_3d_editor_plugin.cpp:6151): Tab and a click (viewport.cpp:1959) focus the view. */
export function useViewFocus(element: HTMLElement | null): void {
  useEffect(() => {
    if (!element) return undefined;
    if (!element.hasAttribute('tabindex')) element.tabIndex = 0;
    const onPointerEnter = () => focusOnPointerEnter(element);
    const onPointerDown = () => element.focus({ preventScroll: true });
    element.addEventListener('pointerenter', onPointerEnter);
    element.addEventListener('pointerdown', onPointerDown);
    return () => {
      element.removeEventListener('pointerenter', onPointerEnter);
      element.removeEventListener('pointerdown', onPointerDown);
    };
  }, [element]);
}

/** Godot sends a key to the focused viewport only (node_3d_editor_plugin.cpp:3604). */
export function isViewKeyEvent(event: KeyboardEvent, element: Element): boolean {
  return event.target instanceof Node && element.contains(event.target) && !isTypingTarget(event.target);
}
