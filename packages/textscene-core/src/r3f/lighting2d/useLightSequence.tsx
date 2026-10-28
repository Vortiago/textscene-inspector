/**
 * `useLightSequence` and `useDirectionalLightSlot`: a light's slot in its canvas light list, in
 * tree order (`lightSequence.ts` says why). The live tree is walked once for all canvases, not per
 * light, since the numbering belongs to the list. Godot keeps one list per canvas
 * (`renderer_canvas_cull.h:153-154`), so a light inside a
 * CanvasLayer belongs to another list.
 */

import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react';
import { liveTreeOf } from '../liveSceneTree.js';
import { useLiveTreeSelection, type SharedLiveTree } from '../useLiveSceneTree.js';
import { useNodePath } from '../contexts/NodePathContext.js';
import { perObject } from '../../utils/perObject.js';
import { sameElements } from '../../utils/sameElements.js';
import { lightPathsByCanvas, type CanvasLightPaths } from './lightSequence.js';

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

const NO_LIGHTS: CanvasLightPaths = { positional: [], directional: [] };

const CanvasLightSequenceContext = createContext<CanvasLightLists>(NO_LISTS);

function numberByPath(paths: readonly string[]): Map<string, number> {
  return new Map(paths.map((path, index) => [path, index]));
}

/** The lists of every canvas of `tree`, from one walk that every provider of the tree shares. */
const canvasListsOfTree = perObject((tree: SharedLiveTree) =>
  lightPathsByCanvas(liveTreeOf(tree.roots, tree.ctx))
);

function sameLightPaths(a: CanvasLightPaths, b: CanvasLightPaths): boolean {
  return sameElements(a.positional, b.positional) && sameElements(a.directional, b.directional);
}

interface CanvasLightSequenceProviderProps {
  /**
   * The path of the SubViewport whose canvas the lists serve, or null for the root canvas. Each
   * SubViewport has a World2D, and so a light list, of its own (`viewport.cpp:5345`).
   */
  viewportPath: string | null;
  children: ReactNode;
}

/**
 * Publishes both lists for one canvas, each from the one preorder walk of the live tree. The
 * directional list skips hidden lights.
 */
export function CanvasLightSequenceProvider({ viewportPath, children }: CanvasLightSequenceProviderProps) {
  const selectCanvas = useCallback(
    (tree: SharedLiveTree) => canvasListsOfTree(tree).get(viewportPath) ?? NO_LIGHTS,
    [viewportPath]
  );
  const paths = useLiveTreeSelection(selectCanvas, sameLightPaths);

  const lists = useMemo<CanvasLightLists>(
    () => ({
      positional: numberByPath(paths?.positional ?? []),
      directional: paths ? numberByPath(paths.directional) : null,
    }),
    [paths]
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
