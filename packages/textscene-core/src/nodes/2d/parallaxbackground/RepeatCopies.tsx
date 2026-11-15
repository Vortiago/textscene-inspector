/**
 * Draws its children once per repeat copy, each in a group shifted by the copy's offset. A canvas
 * item under a repeat source draws once per copy, unless a nearer repeat source replaces it
 * (`renderer_canvas_cull.cpp:368-380`), so a nested source draws only in the outer source's
 * unrepeated copy: it reads `useIsRepeatBaseCopy` and renders nothing elsewhere.
 */

import { createContext, useContext, type ReactNode } from 'react';
import type { Vector2 } from '../../../godot/math/vector';

/** False inside a copy shifted away from the repeat source's own position. Written only by `RepeatCopies`. */
const RepeatBaseCopyContext = createContext(true);
RepeatBaseCopyContext.displayName = 'RepeatBaseCopyContext';

export function useIsRepeatBaseCopy(): boolean {
  return useContext(RepeatBaseCopyContext);
}

/**
 * `offsets` come from `parallaxRepeatOffsets`, in the source's local space and Godot's Y down.
 * No offsets draws the children once, unshifted.
 */
export function RepeatCopies({ offsets, children }: { offsets: readonly Vector2[]; children: ReactNode }) {
  if (offsets.length === 0) return children;
  return offsets.map((offset, index) => (
    // paint-order-safe: wraps dispatched children, each of which
    // brings its own canvas-item wrapper nearer than this one.
    <group key={`repeat-${index}`} position={[offset.x, 0 - offset.y, 0]}>
      <RepeatBaseCopyContext.Provider value={offset.x === 0 && offset.y === 0}>
        {children}
      </RepeatBaseCopyContext.Provider>
    </group>
  ));
}
