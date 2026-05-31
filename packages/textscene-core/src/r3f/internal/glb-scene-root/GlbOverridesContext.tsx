/**
 * BUG 2: carries an instancing node's inline override children down to
 * the `GLBSceneRoot` that renders the GLB it instances.
 *
 * Godot's GLB-internal-node overrides (e.g. `roof_lamp.tscn`'s
 * `plafoniera` child with `parent="." index="0"`) are declared as inline
 * children of the instancing node. But the GLB is rendered in a SEPARATE
 * synthesised scene by `InstancedSceneSubtree`, so `GLBSceneRoot` cannot
 * see those siblings on its own. The instancing `DispatchedNode`
 * publishes them here; `GLBSceneRoot` consumes them and matches each
 * onto the GLB's internal node by name.
 *
 * Defaults to an empty list so a GLB instanced with no override children
 * (the common case) renders unchanged.
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
