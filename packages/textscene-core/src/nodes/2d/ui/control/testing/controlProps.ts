/** Control properties for a test, holding the CanvasItem defaults an unset Control parses to. */
import { parseControlCanvasItem } from '../parser';
import type { ControlCanvasItemFields } from '../types';

export function controlProps<T extends { name: string }>(fields: T): ControlCanvasItemFields & T {
  return { ...parseControlCanvasItem({}, fields.name), ...fields };
}
