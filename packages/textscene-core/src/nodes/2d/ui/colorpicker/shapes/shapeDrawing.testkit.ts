/** Draws one named Control of a shape variant, so a test reads one `draw` callback at a time. */
import type { Rect2 } from '../../../../../godot/math/rect2';
import type { PickerShapeColor, ShapeControl, ShapeDrawing, ShapeVariant } from './shapeDrawing';

function findControl(controls: readonly ShapeControl[], name: string): ShapeControl | undefined {
  for (const control of controls) {
    if (control.name === name) return control;
    const found = findControl(control.children ?? [], name);
    if (found) return found;
  }
  return undefined;
}

/** What the Control called `name` draws over its own `rect`. It throws when the variant has no such Control. */
export function drawControl(
  variant: ShapeVariant,
  name: string,
  rect: Rect2,
  color: PickerShapeColor
): ShapeDrawing {
  const draw = findControl(variant.controls, name)?.draw;
  if (!draw) throw new Error(`expected a drawn Control called ${name}, found none`);
  return draw(rect, color);
}

/** The names of `variant`'s Controls, nested as the shape adds them. */
export function controlTree(variant: ShapeVariant): unknown[] {
  const tree = (controls: readonly ShapeControl[]): unknown[] =>
    controls.map((control) => (control.children ? { [control.name]: tree(control.children) } : control.name));
  return tree(variant.controls);
}
