/**
 * True when the target takes typed text: an `<input>`, a `<textarea>` (the web app's Source pane,
 * ADR-0020) or a contentEditable element. Without it, a global shortcut such as F-to-frame or
 * Escape-deselect takes "f" or "Escape" from someone editing `.tscn` text.
 */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
}
