/**
 * The panel's `SceneGraph`, which the shell parses. It is null until the first
 * successful parse, and a consumer then renders a passive loading state,
 * never a throw or a partial render (R3F-contracts.md §4).
 */
import { createContext, useContext, useSyncExternalStore, type ReactNode } from 'react';
import type { SceneGraph } from '../../core/SceneGraph.js';
import { subscribeToNothing } from '../../utils/subscribeToNothing.js';
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
  return useSyncExternalStore(
    hierarchy?.scene?.subscribe ?? subscribeToNothing,
    hierarchy?.scene?.written ?? (() => hierarchy?.sceneGraph ?? null)
  );
}
