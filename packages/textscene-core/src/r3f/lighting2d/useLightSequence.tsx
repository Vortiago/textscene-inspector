/**
 * `useLightSequence`: this light's slot in the canvas light list, in tree order
 * (`lightSequence.ts` says why). The live tree is walked once per canvas, not per
 * light, since the numbering belongs to the list. Godot keeps one list per
 * canvas, so a light inside a CanvasLayer belongs to another list.
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

  // A light outside a scene hierarchy, or in a sub-scene not yet loaded, falls
  // back to its ordinal.
  if (!path) return ordinal;
  return sequence.get(path) ?? ordinal;
}
