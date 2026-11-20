/**
 * Godot warns on a CSG shape whose brush is empty and on each shape below it (`csg_shape.cpp:977-988`).
 * A shape reports through `useReportEmptyShape` to the view's status.
 */
import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { parentPathOf } from '../../utils/nodePath.js';
import { useViewStatusStore } from '../viewStatus/ViewStatusContext.js';
import { useNodePath } from './NodePathContext.js';

/** The nearest enclosing CSG shape, which a child checks against its own parent path. */
interface ParentShape {
  path: string;
  isEmpty: boolean;
}

const ParentShapeContext = createContext<ParentShape | null>(null);
ParentShapeContext.displayName = 'ParentShapeContext';

/**
 * Reports the enclosing node while its shape is empty, and returns whether it is. A shape is empty
 * when its own brush is, or when its direct CSG parent's shape is: `CSGBox3D > Node3D > CSGSphere3D`
 * is two roots, so only the parent's own path counts.
 */
export function useReportEmptyShape(hasOwnEmptyBrush: boolean): boolean {
  const path = useNodePath();
  const parent = useContext(ParentShapeContext);
  const isParentEmpty =
    parent !== null && path !== null && parent.isEmpty && parent.path === parentPathOf(path);
  const isEmpty = hasOwnEmptyBrush || isParentEmpty;
  const store = useViewStatusStore();
  useEffect(() => {
    if (!store || !isEmpty || path === null) return undefined;
    return store.reportUndrawn(path, 'empty-shape');
  }, [store, isEmpty, path]);
  return isEmpty;
}

/** Tells the shapes below whether the enclosing node's shape is empty. */
export function EmptyShapeBranch({ isEmpty, children }: { isEmpty: boolean; children?: ReactNode }) {
  const path = useNodePath();
  const parent = useMemo(() => (path === null ? null : { path, isEmpty }), [path, isEmpty]);
  return <ParentShapeContext.Provider value={parent}>{children}</ParentShapeContext.Provider>;
}
