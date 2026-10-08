/**
 * `useLightSequence` and `useDirectionalLightSlot`: a light's slot in its canvas light list, in
 * tree order (`lightSequence.ts` says why). The live tree is walked once per canvas, not per light,
 * since the numbering belongs to the list. Godot keeps one list per canvas
 * (`renderer_canvas_cull.h:153-154`), so a light inside a
 * CanvasLayer belongs to another list.
 */

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { MAX_2D_DIRECTIONAL_LIGHTS } from '../../godot/rendering.js';
import type { LiveTreeEntry } from '../liveSceneTree.js';
import { useHasLiveTree, useLiveSceneNodes } from '../useLiveSceneTree.js';
import { useNodePath } from '../contexts/NodePathContext.js';
import { keepsChildrenInViewport } from '../../nodes/viewport/subviewport/viewportBoundary.js';
import {
  holdsListedDirectionalLights,
  isListedDirectionalLight,
  isPositionalCanvasLight,
} from './lightSequence.js';

interface CanvasLightLists {
  /** `path → sequence` over the positional lights. */
  readonly positional: ReadonlyMap<string, number>;
  /**
   * `path → slot` over the directional lights Godot lists, at most `MAX_2D_DIRECTIONAL_LIGHTS`
   * (`renderer_viewport.cpp:511`).
   * Null with no live tree to walk.
   */
  readonly directional: ReadonlyMap<string, number> | null;
}

const NO_LISTS: CanvasLightLists = { positional: new Map(), directional: null };

const CanvasLightSequenceContext = createContext<CanvasLightLists>(NO_LISTS);

function numberByPath(entries: readonly LiveTreeEntry[]): Map<string, number> {
  const map = new Map<string, number>();
  entries.forEach((entry, index) => map.set(entry.path, index));
  return map;
}

/**
 * Publishes both lists for the canvas, each from a single preorder walk of the live tree. Neither
 * walk enters a SubViewport, whose World2D keeps its own lists (`viewport.cpp:5345`), and the
 * directional walk skips hidden subtrees.
 */
export function CanvasLightSequenceProvider({ children }: { children: ReactNode }) {
  // Module-level predicates: `useLiveSceneNodes` memoises on them, so an inline
  // arrow would re-walk the tree every render.
  const positional = useLiveSceneNodes(isPositionalCanvasLight, keepsChildrenInViewport);
  const directional = useLiveSceneNodes(isListedDirectionalLight, holdsListedDirectionalLights);
  const hasTree = useHasLiveTree();

  const lists = useMemo<CanvasLightLists>(
    () => ({
      positional: numberByPath(positional),
      directional: hasTree ? numberByPath(directional.slice(0, MAX_2D_DIRECTIONAL_LIGHTS)) : null,
    }),
    [positional, directional, hasTree]
  );

  return <CanvasLightSequenceContext.Provider value={lists}>{children}</CanvasLightSequenceContext.Provider>;
}

/**
 * This light's place in the positional list, or null for a light the walk never saw: one outside a
 * scene hierarchy, or in a sub-scene not yet loaded.
 */
export function useLightSequence(): number | null {
  const { positional } = useContext(CanvasLightSequenceContext);
  const path = useNodePath();
  if (!path) return null;
  return positional.get(path) ?? null;
}

/**
 * This DirectionalLight2D's slot in the directional list, its draw order among the directional
 * lights, or null when Godot leaves it off the list: disabled, hidden, or past the eighth
 * (`light_2d.cpp:59`, `renderer_viewport.cpp:492-513`). With no
 * live tree to walk, a light takes slot 0.
 */
export function useDirectionalLightSlot(): number | null {
  const { directional } = useContext(CanvasLightSequenceContext);
  const path = useNodePath();
  if (!path || !directional) return 0;
  return directional.get(path) ?? null;
}
