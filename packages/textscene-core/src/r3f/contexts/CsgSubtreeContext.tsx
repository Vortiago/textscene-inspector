/**
 * Tells a CSG node whether its own solid has been absorbed into an ancestor's boolean.
 *
 * The alternative would be for the dispatcher to skip CSG children outright, and that is
 * exactly what must NOT happen: `PlainNode` is the sole caller of `registerNodeObject`,
 * so a skipped child loses tree-selection, highlighting and the hidden-eye toggle. And
 * `subtreeConformance.test.tsx` renders every registered type with a probe child and
 * asserts it survives, which a root that swallowed its `children` would fail.
 *
 * So contributors stay mounted and remove their own MESH, from the inside. This context
 * is how they find out to.
 *
 * Keyed by node PATH rather than a boolean "inside a CSG subtree" flag. Godot sets
 * `parent_shape` only for a DIRECT CSG parent, so `CSGBox3D > Node3D > CSGSphere3D` is
 * two independent roots; a boolean flag would swallow the sphere and would need every
 * non-CSG component in the codebase to reset it.
 */

import { createContext, useContext, type ReactNode } from 'react';

/**
 * `pending` while the CSG library is still loading, `failed` when it could not load or
 * the evaluator threw. On `failed` every contributor un-prunes and draws its own solid,
 * which is the retired CSG-as-primitive behaviour serving as the degraded fallback.
 */
export type CsgSubtreeStatus = 'pending' | 'ready' | 'failed';

export interface CsgSubtreeValue {
  status: CsgSubtreeStatus;
  /** Node paths whose solids this root has taken over. */
  absorbedPaths: ReadonlySet<string>;
}

const CsgSubtreeContext = createContext<CsgSubtreeValue | null>(null);
CsgSubtreeContext.displayName = 'CsgSubtreeContext';

export interface CsgSubtreeProviderProps {
  value: CsgSubtreeValue;
  children: ReactNode;
}

export function CsgSubtreeProvider({ value, children }: CsgSubtreeProviderProps) {
  return <CsgSubtreeContext.Provider value={value}>{children}</CsgSubtreeContext.Provider>;
}

/** The enclosing CSG root's state, or null outside one. */
export function useCsgSubtree(): CsgSubtreeValue | null {
  return useContext(CsgSubtreeContext);
}

/**
 * True when this node's solid belongs to an ancestor's boolean rather than to itself.
 *
 * False on `failed`, which is what makes the fallback work: every contributor starts
 * drawing its own solid again without any of them needing to know why.
 */
export function useIsCsgContribution(path: string | null): boolean {
  const subtree = useCsgSubtree();
  if (!subtree || path === null) return false;
  if (subtree.status === 'failed') return false;
  return subtree.absorbedPaths.has(path);
}
