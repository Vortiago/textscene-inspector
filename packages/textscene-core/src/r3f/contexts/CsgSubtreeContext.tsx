/**
 * Tells a CSG node whether an ancestor's boolean absorbed its solid. A skipped
 * child would lose selection and the hidden toggle, so it stays mounted and drops
 * its own mesh. Keyed by path, since Godot sets `parent_shape` only for a direct
 * CSG parent: `CSGBox3D > Node3D > CSGSphere3D` is two roots.
 */

import { createContext, useContext, type ReactNode } from 'react';

/**
 * `pending` while the CSG library loads, `failed` when it could not load or the
 * evaluator threw. On `failed` every contributor draws its own solid as the fallback.
 */
export type CsgSubtreeStatus = 'pending' | 'ready' | 'failed';

export interface CsgSubtreeValue {
  status: CsgSubtreeStatus;
  /** Node paths whose solids this root has taken over. */
  absorbedPaths: ReadonlySet<string>;
  /**
   * Node paths skipped as invisible, which contribute a point at their origin
   * instead of their solid. `CsgPlan.invisiblePaths` has the Godot rule.
   */
  invisiblePaths: ReadonlySet<string>;
}

const CsgSubtreeContext = createContext<CsgSubtreeValue | null>(null);
CsgSubtreeContext.displayName = 'CsgSubtreeContext';

export interface CsgSubtreeProviderProps {
  /** Null re-publishes "outside a CSG root", which is what a node with no plan passes on. */
  value: CsgSubtreeValue | null;
  children: ReactNode;
}

export function CsgSubtreeProvider({ value, children }: CsgSubtreeProviderProps) {
  return <CsgSubtreeContext.Provider value={value}>{children}</CsgSubtreeContext.Provider>;
}

/** The enclosing CSG root's state, or null outside one. */
export function useCsgSubtree(): CsgSubtreeValue | null {
  return useContext(CsgSubtreeContext);
}

