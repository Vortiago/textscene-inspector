/** Input types that take no typed text, so a key pressed on one is not typing (Godot's `is_text_field`). */
const NON_TEXT_INPUT_TYPES = new Set([
  'button',
  'checkbox',
  'color',
  'file',
  'image',
  'radio',
  'range',
  'reset',
  'submit',
]);

/** Without it, a shortcut such as Escape-deselect takes "Escape" from text being typed (ADR-0020). */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target instanceof HTMLInputElement) return !NON_TEXT_INPUT_TYPES.has(target.type);
  return target.tagName === 'TEXTAREA' || target.isContentEditable;
}
