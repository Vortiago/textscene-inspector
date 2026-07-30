/**
 * `useLightSequence` — this light's slot in the canvas light list.
 *
 * The rationale for using tree order rather than the registration ordinal is in
 * `lightSequence.ts`. This is the React half: the LIVE tree (which composes
 * instanced sub-scenes into one path space, ADR-0013) is walked ONCE for the
 * canvas, and each light looks itself up by the path every dispatched node
 * already carries.
 *
 * The walk belongs to the PASS, not to the light. The numbering is a property
 * of the canvas's light list — which light comes second says nothing about that
 * light on its own — and deriving it per light meant one whole-tree walk and
 * four resource-bus subscriptions for each, every one producing the identical
 * map. It is also where the rule will have to change next: Godot keeps a light
 * list per CANVAS, so a light inside a CanvasLayer belongs to a different list,
 * and that is a fact about the pass rather than about any node.
 *
 * Falls back to the ordinal when the path is not in the map — a light mounted
 * outside a scene hierarchy (bare test scaffolding), or the frame before a
 * sub-scene carrying it has loaded. That is exactly the previous behaviour, so
 * the fallback degrades to "as good as before" rather than to zero.
 */

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useLiveSceneNodes } from '../useLiveSceneTree.js';
import { useNodePath } from '../contexts/NodePathContext.js';
import { isPositionalCanvasLight } from './lightSequence.js';

const EMPTY_SEQUENCE: ReadonlyMap<string, number> = new Map();

const CanvasLightSequenceContext = createContext<ReadonlyMap<string, number>>(EMPTY_SEQUENCE);

/**
 * Publishes `path → sequence` for every positional light on the canvas, from a
 * single preorder walk of the live tree.
 */
export function CanvasLightSequenceProvider({ children }: { children: ReactNode }) {
  // A module-level predicate: `useLiveSceneNodes` memoises on it, so an inline
  // arrow would re-walk the tree every render.
  const lights = useLiveSceneNodes(isPositionalCanvasLight);

  const sequence = useMemo(() => {
    const map = new Map<string, number>();
    lights.forEach((entry, index) => map.set(entry.path, index));
    return map;
  }, [lights]);

  return (
    <CanvasLightSequenceContext.Provider value={sequence}>
      {children}
    </CanvasLightSequenceContext.Provider>
  );
}

export function useLightSequence(ordinal: number): number {
  const sequence = useContext(CanvasLightSequenceContext);
  const path = useNodePath();

  if (!path) return ordinal;
  return sequence.get(path) ?? ordinal;
}
