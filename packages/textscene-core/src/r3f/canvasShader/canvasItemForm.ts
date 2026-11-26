export type CanvasItemForm = 'classic' | 'translated';

/** `?canvasItem=translated` draws an item without a shader of its own through Godot's canvas template. */
function canvasItemFormOf(search: string): CanvasItemForm {
  return new URLSearchParams(search).get('canvasItem') === 'translated' ? 'translated' : 'classic';
}

/** Read once, when the module loads, so every item on the page draws in one form. */
const LOADED_FORM: CanvasItemForm =
  typeof window === 'undefined' ? 'classic' : canvasItemFormOf(window.location.search);

export function canvasItemForm(): CanvasItemForm {
  return LOADED_FORM;
}
