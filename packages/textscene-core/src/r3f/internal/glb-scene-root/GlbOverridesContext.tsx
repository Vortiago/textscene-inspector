/**
 * Carries an instancing node's inline override children to the `GLBSceneRoot` of the GLB it
 * instances. `InstancedSceneSubtree` renders the GLB in a separate synthesised scene, so the root
 * cannot see them. The default is an empty list, which renders the GLB unchanged.
 */
import { createContext, useContext, type ReactNode } from 'react';
import type { TscnNode } from '../../../parser/types';

const GlbOverridesContext = createContext<readonly TscnNode[]>([]);
GlbOverridesContext.displayName = 'GlbOverridesContext';

export function useGlbOverrides(): readonly TscnNode[] {
  return useContext(GlbOverridesContext);
}

export interface GlbOverridesProviderProps {
  overrides: readonly TscnNode[];
  children: ReactNode;
}

export function GlbOverridesProvider({ overrides, children }: GlbOverridesProviderProps) {
  return (
    <GlbOverridesContext.Provider value={overrides}>{children}</GlbOverridesContext.Provider>
  );
}
