/**
 * `useLightSequence` — this light's slot in the canvas light list.
 *
 * The rationale for using tree order rather than the registration ordinal is in
 * `lightSequence.ts`. This is the React half: it walks the LIVE tree (which
 * composes instanced sub-scenes into one path space, ADR-0013) and looks this
 * node up by the path every dispatched node already carries.
 *
 * Falls back to the ordinal when the path is not in the map — a light mounted
 * outside a scene hierarchy (bare test scaffolding), or the frame before a
 * sub-scene carrying it has loaded. That is exactly the previous behaviour, so
 * the fallback degrades to "as good as before" rather than to zero.
 */

import { useMemo } from 'react';
import { useLiveSceneNodes } from '../useLiveSceneTree.js';
import { useNodePath } from '../contexts/NodePathContext.js';
import { isPositionalCanvasLight } from './lightSequence.js';

export function useLightSequence(ordinal: number): number {
  // A module-level predicate: `useLiveSceneNodes` memoises on it, so an inline
  // arrow would re-walk the tree every render.
  const lights = useLiveSceneNodes(isPositionalCanvasLight);
  const path = useNodePath();

  const sequence = useMemo(() => {
    const map = new Map<string, number>();
    lights.forEach((entry, index) => map.set(entry.path, index));
    return map;
  }, [lights]);

  if (!path) return ordinal;
  return sequence.get(path) ?? ordinal;
}
