/**
 * The CSG shapes with an empty shape, for the node's details. Godot warns on a shape whose brush
 * is empty and on each shape below it (`csg_shape.cpp:977-988`). A shape reports through
 * `useReportEmptyShape`, and with no provider a report does nothing.
 */
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { parentPathOf } from '../../utils/nodePath.js';
import { createCountedReportsContext } from './countedReportsContext.js';
import { useNodePath } from './NodePathContext.js';

/** The path of each node with an empty shape. */
const emptyShapes = createCountedReportsContext('EmptyShapes');

export const EmptyShapesProvider = emptyShapes.Provider;

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
  emptyShapes.useReportWhile(isEmpty ? path : null);
  return isEmpty;
}

/** Tells the shapes below whether the enclosing node's shape is empty. */
export function EmptyShapeBranch({ isEmpty, children }: { isEmpty: boolean; children?: ReactNode }) {
  const path = useNodePath();
  const parent = useMemo(() => (path === null ? null : { path, isEmpty }), [path, isEmpty]);
  return <ParentShapeContext.Provider value={parent}>{children}</ParentShapeContext.Provider>;
}

/** Whether the node at `nodePath` has an empty shape. */
export function useIsEmptyShape(nodePath: string): boolean {
  return emptyShapes.useReported().has(nodePath);
}
