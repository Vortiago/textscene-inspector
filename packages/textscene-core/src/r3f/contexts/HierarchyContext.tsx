/**
 * The panel's `SceneGraph`, which the shell parses. It is null until the first
 * successful parse, and a consumer then renders a passive loading state,
 * never a throw or a partial render (R3F-contracts.md §4).
 */
import { createContext, useContext, type ReactNode } from 'react';
import type { TscnNode } from '../../parser/types.js';
import type { SceneGraph } from '../../core/SceneGraph.js';
import { useSceneSnapshot } from '../hooks/useSceneSnapshot.js';
import type { Scene } from '../../scene/openScene.js';

export interface HierarchyContextValue {
  sceneGraph: SceneGraph | null;
  panelId: string;
  /** The scene the graph is drawn from, which holds the current cameras a view reads. */
  scene?: Scene;
}

const HierarchyContext = createContext<HierarchyContextValue | null>(null);
HierarchyContext.displayName = 'HierarchyContext';

export interface HierarchyProviderProps {
  value: HierarchyContextValue;
  children: ReactNode;
}

export function HierarchyProvider({ value, children }: HierarchyProviderProps) {
  return <HierarchyContext.Provider value={value}>{children}</HierarchyContext.Provider>;
}

export function useHierarchy(): HierarchyContextValue {
  const value = useContext(HierarchyContext);
  if (value === null) {
    throw new Error(
      'useHierarchy must be used inside a <TscnPreviewShell> (HierarchyProvider). ' +
        'See R3F-contracts.md §4.'
    );
  }
  return value;
}

/**
 * Returns `null` instead of throwing with no provider, so a canvas mounted
 * alone in a test still renders.
 */
export function useOptionalHierarchy(): HierarchyContextValue | null {
  return useContext(HierarchyContext);
}

export function useWrittenGraph(): SceneGraph | null {
  const hierarchy = useOptionalHierarchy();
  return useSceneSnapshot(hierarchy?.scene, (scene) => scene.written(), hierarchy?.sceneGraph ?? null);
}

/** A hosted scene dispatches its live roots. A detached view dispatches the roots it supplies. */
export function useDispatchRoots(roots: readonly TscnNode[] | null): readonly TscnNode[] | undefined {
  return useOptionalHierarchy()?.scene ? undefined : (roots ?? undefined);
}
