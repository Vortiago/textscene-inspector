/** A `StyleBoxFlat` that paints, for a test of a painter whose default box for a slot is empty. */
import { parseStyleBox, type ResolvedStyleBox } from '../parseStyleBox';

export function drawnStyleBox(data: Record<string, string> = {}): ResolvedStyleBox {
  return parseStyleBox(
    'SubResource("drawn")',
    [],
    [{ id: 'drawn', type: 'StyleBoxFlat', data: { bg_color: 'Color(1, 0, 0, 1)', ...data } }],
    false
  )!;
}
