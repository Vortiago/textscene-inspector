/**
 * Diagnostics for a sprite sheet's frame keys, from the file-order replay in
 * `godot/spriteFrames.ts` that the render parsers also draw from. A refused
 * write (ERR_FAIL_INDEX) is an error, and a write a later `hframes` re-maps is
 * a warning. A grid literal no int slot holds is phase 1's diagnostic.
 */

import type { Diagnostic } from './types.js';
import type { TscnNode } from '../parser/types.js';
import { replaySpriteFrames, type FrameWrite } from '../godot/spriteFrames.js';

export { replaySpriteFrames } from '../godot/spriteFrames.js';

/** Why the grid a write was judged against is smaller than the one the file ends up with. */
function lateGridHint(key: string): string {
  return ` Godot applies properties in file order, so an 'hframes'/'vframes' line below '${key}' is not in effect yet; move it above.`;
}

/**
 * Every diagnostic the frame keys earn, named `${prefix}-frame-range`,
 * `${prefix}-frame-coords-range` and `${prefix}-frame-remapped`.
 */
export function spriteFrameDiagnostics(
  node: TscnNode,
  rawProps: Record<string, string>,
  prefix: string
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  // Each rule name is spelled whole at its site: the emits guard pins a
  // template to the `prefix` a slice passes, and a second interpolation would
  // leave it unpinnable.
  const at = { nodeName: node.name, nodeType: node.type };
  const state = replaySpriteFrames(rawProps);
  const refused = (write: FrameWrite) =>
    `Godot refuses the assignment, so the sprite loads on frame 0.` +
    (state.lastGridIndex > write.index ? lateGridHint(write.key) : '');

  for (const write of state.writes) {
    if (write.index > state.gridUnknownFrom) continue;
    if (write.key === 'frame') {
      // A negative index is refused too, but phase 1's `min: 0` already says so.
      if (!write.refused.x || write.authored < 0) continue;
      const maxFrame = write.hframes * write.vframes;
      diagnostics.push({
        ...at,
        severity: 'error',
        ruleName: `${prefix}-frame-range`,
        message: `Frame ${write.authored} is out of range. Maximum frame is ${maxFrame - 1} (hframes=${write.hframes}, vframes=${write.vframes}). ` + refused(write),
      });
      continue;
    }
    // Each component is refused on its own; a negative one is phase 1's
    // `min: 0` and gets no second report, while its sibling is still judged.
    const { x, y } = write.coords!;
    if (write.refused.x && x >= 0) {
      diagnostics.push({
        ...at,
        severity: 'error',
        ruleName: `${prefix}-frame-coords-range`,
        message: `frame_coords.x (${x}) is out of range. Maximum is ${write.hframes - 1} (hframes=${write.hframes}). ` + refused(write),
      });
    }
    if (write.refused.y && y >= 0) {
      diagnostics.push({
        ...at,
        severity: 'error',
        ruleName: `${prefix}-frame-coords-range`,
        message: `frame_coords.y (${y}) is out of range. Maximum is ${write.vframes - 1} (vframes=${write.vframes}). ` + refused(write),
      });
    }
  }

  const remap = state.remap;
  if (remap && remap.write.index <= state.gridUnknownFrom) {
    const { write, to } = remap;
    const stored = { x: to % state.hframes, y: Math.trunc(to / state.hframes) };
    // The remap keeps a row and column, so an authored coordinate pair usually
    // survives it; only a changed pair is worth a line.
    const sameCoords = write.coords !== undefined && write.coords.x === stored.x && write.coords.y === stored.y;
    if (!sameCoords) {
      const authored = write.coords ? `frame_coords (${write.coords.x}, ${write.coords.y})` : `Frame ${write.authored}`;
      diagnostics.push({
        ...at,
        severity: 'warning',
        ruleName: `${prefix}-frame-remapped`,
        message: `${authored} is stored as frame ${to} (${stored.x}, ${stored.y}): an 'hframes' line below '${write.key}' re-maps the frame onto the new sheet. Move the grid above '${write.key}', or author the stored value.`,
      });
    }
  }
  return diagnostics;
}
