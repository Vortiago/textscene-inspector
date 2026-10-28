/**
 * `useLightSequence` and `useDirectionalLightSlot`: a light's slot in its canvas light list, in
 * tree order (`lightSequence.ts` says why). The live tree is walked once for all canvases, not per
 * light, since the numbering belongs to the list. A viewport gathers the lights of all its canvases,
 * its CanvasLayers included, into one list (`renderer_viewport.cpp:443-466`).
 */

import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react';
import { liveTreeOf } from '../liveSceneTree.js';
import { useLiveTreeSelection, type SharedLiveTree } from '../useLiveSceneTree.js';
import { useNodePath } from '../contexts/NodePathContext.js';
import { sameElements } from '../../utils/sameElements.js';
import { canvasScopesOf, type CanvasLightPaths } from '../canvasScopes.js';

interface CanvasLightLists {
  /** `path → sequence` over the positional lights. */
  readonly positional: ReadonlyMap<string, number>;
  /** `path → slot` over the directional lights Godot lists. Null with no live tree to walk. */
  readonly directional: ReadonlyMap<string, number> | null;
}

const NO_LISTS: CanvasLightLists = { positional: new Map(), directional: null };

const NO_LIGHTS: CanvasLightPaths = { positional: [], directional: [] };

const CanvasLightSequenceContext = createContext<CanvasLightLists>(NO_LISTS);

function numberByPath(paths: readonly string[]): Map<string, number> {
  return new Map(paths.map((path, index) => [path, index]));
}

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
    (tree: SharedLiveTree) =>
      canvasScopesOf(liveTreeOf(tree.roots, tree.ctx)).lights.get(viewportPath) ?? NO_LIGHTS,
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
 * lights, or null when Godot leaves it off the list: disabled, hidden, or past the cap of its canvas
 * (`light_2d.cpp:59`, `renderer_viewport.cpp:492-513`). With no live tree to walk, a light takes
 * slot 0.
 */
export function useDirectionalLightSlot(): number | null {
  const { directional } = useContext(CanvasLightSequenceContext);
  const path = useNodePath();
  if (!path || !directional) return 0;
  return directional.get(path) ?? null;
}
