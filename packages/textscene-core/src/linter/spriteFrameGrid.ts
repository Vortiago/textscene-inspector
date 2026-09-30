/**
 * Diagnostics for a sprite sheet's frame keys, from the file-order replay in
 * `godot/spriteFrames.ts` that the render parsers also draw from. A refused
 * write (ERR_FAIL_INDEX) is an error, and a write a later `hframes` re-maps is
 * a warning. A grid literal no int slot holds is phase 1's diagnostic.
 */

import type { Diagnostic } from './types.js';
import type { TscnNode } from '../parser/types.js';
import { reportArm, type RuleArms } from './ruleArms.js';
import { replaySpriteFrames, type FrameWrite } from '../godot/spriteFrames.js';

export { replaySpriteFrames } from '../godot/spriteFrames.js';

/** Why the grid a write was judged against is smaller than the one the file ends up with. */
function lateGridHint(key: string): string {
  return ` Godot applies properties in file order, so an 'hframes'/'vframes' line below '${key}' is not in effect yet; move it above.`;
}

/** The `file:line` of each class's own setter behind an arm. */
interface FrameSetterCites {
  readonly frame: string;
  readonly frameCoords: string;
  readonly remap: string;
}

/** The frame-key arms under `prefix`, the node-type slug, grounded at the class's own setters. */
export function spriteFrameArms(prefix: string, at: FrameSetterCites) {
  const arms = {
    frameRange: {
      severity: 'error',
      ruleName: `${prefix}-frame-range`,
      grounding: { kind: 'engine', at: at.frame },
    },
    frameCoordsRange: {
      severity: 'error',
      ruleName: `${prefix}-frame-coords-range`,
      grounding: { kind: 'engine', at: at.frameCoords },
    },
    frameRemapped: {
      severity: 'warning',
      ruleName: `${prefix}-frame-remapped`,
      grounding: { kind: 'engine', at: at.remap },
    },
  } as const satisfies RuleArms<'frameRange' | 'frameCoordsRange' | 'frameRemapped'>;
  return arms;
}

export type SpriteFrameArms = ReturnType<typeof spriteFrameArms>;

/** Every diagnostic the frame keys earn, each through one of `arms`. */
export function spriteFrameDiagnostics(
  node: TscnNode,
  rawProps: Record<string, string>,
  arms: SpriteFrameArms
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
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
      reportArm(
        diagnostics,
        arms.frameRange,
        node,
        `Frame ${write.authored} is out of range. Maximum frame is ${maxFrame - 1} (hframes=${write.hframes}, vframes=${write.vframes}). ` + refused(write)
      );
      continue;
    }
    // Each component is refused on its own; a negative one is phase 1's
    // `min: 0` and gets no second report, while its sibling is still judged.
    const { x, y } = write.coords!;
    if (write.refused.x && x >= 0) {
      reportArm(
        diagnostics,
        arms.frameCoordsRange,
        node,
        `frame_coords.x (${x}) is out of range. Maximum is ${write.hframes - 1} (hframes=${write.hframes}). ` + refused(write)
      );
    }
    if (write.refused.y && y >= 0) {
      reportArm(
        diagnostics,
        arms.frameCoordsRange,
        node,
        `frame_coords.y (${y}) is out of range. Maximum is ${write.vframes - 1} (vframes=${write.vframes}). ` + refused(write)
      );
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
      reportArm(
        diagnostics,
        arms.frameRemapped,
        node,
        `${authored} is stored as frame ${to} (${stored.x}, ${stored.y}): an 'hframes' line below '${write.key}' re-maps the frame onto the new sheet. Move the grid above '${write.key}', or author the stored value.`
      );
    }
  }
  return diagnostics;
}
