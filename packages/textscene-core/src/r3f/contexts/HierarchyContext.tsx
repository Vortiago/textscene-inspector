/**
 * Per-panel scene-graph context. Read-only for consumers — the shell owns
 * the parse and provides the resulting `SceneGraph` here.
 *
 * `sceneGraph` is null until the first successful parse. Consumers must
 * render a passive loading state on null, never throw, never partial — see
 * R3F-contracts.md §4.
 */
import { createContext, useContext, type ReactNode } from 'react';
import type { SceneGraph } from '../../core/SceneGraph.js';

export interface HierarchyContextValue {
  sceneGraph: SceneGraph | null;
  panelId: string;
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
