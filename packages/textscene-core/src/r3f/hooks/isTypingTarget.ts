/**
 * Guard for global keyboard shortcuts (F-to-frame, Escape-deselect):
 * true when the event target is somewhere a user could be typing text — an
 * `<input>`, a `<textarea>` (the web app's Source pane, ADR-0020), or any
 * contentEditable element. Without this guard, a global keydown listener
 * would hijack "f" or "Escape" from someone editing `.tscn` text in the
 * pane.
 */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
}
