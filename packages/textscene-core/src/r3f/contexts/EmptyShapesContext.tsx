/**
 * The CSG shapes with an empty shape, for the node's details. Godot warns on a shape whose brush
 * is empty and on each shape below it (`csg_shape.cpp:977-988`). A shape reports through
 * `useEmptyShape`, and with no provider a report does nothing.
 */
import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { useCountedReports } from '../hooks/useCountedReports.js';
import { useNodePath } from './NodePathContext.js';

interface EmptyShapeReports {
  report: (path: string) => void;
  clear: (path: string) => void;
}

/** Apart from the reports, so a change to the set re-renders only its readers, not each reporter. */
const EmptyShapeReportsContext = createContext<EmptyShapeReports>({ report: () => {}, clear: () => {} });
EmptyShapeReportsContext.displayName = 'EmptyShapeReportsContext';

/** The path of each node with an empty shape. */
const EmptyShapesContext = createContext<ReadonlySet<string>>(new Set());
EmptyShapesContext.displayName = 'EmptyShapesContext';

/** The nearest enclosing CSG shape, which a child checks against its own parent path. */
interface ParentShape {
  path: string;
  isEmpty: boolean;
}

const ParentShapeContext = createContext<ParentShape | null>(null);
ParentShapeContext.displayName = 'ParentShapeContext';

/** Null for the scene root, whose path holds no slash. */
function parentPathOf(path: string): string | null {
  const cut = path.lastIndexOf('/');
  return cut === -1 ? null : path.slice(0, cut);
}

export function EmptyShapesProvider({ children }: { children: ReactNode }) {
  const { reported: emptyPaths, report, clear } = useCountedReports();
  const reports = useMemo(() => ({ report, clear }), [report, clear]);
  return (
    <EmptyShapeReportsContext.Provider value={reports}>
      <EmptyShapesContext.Provider value={emptyPaths}>{children}</EmptyShapesContext.Provider>
    </EmptyShapeReportsContext.Provider>
  );
}

/**
 * Reports the enclosing node while its shape is empty, and returns whether it is. A shape is empty
 * when its own brush is, or when its direct CSG parent's shape is: `CSGBox3D > Node3D > CSGSphere3D`
 * is two roots, so only the parent's own path counts.
 */
export function useEmptyShape(hasOwnEmptyBrush: boolean): boolean {
  const path = useNodePath();
  const parent = useContext(ParentShapeContext);
  const { report, clear } = useContext(EmptyShapeReportsContext);
  const isParentEmpty =
    parent !== null && path !== null && parent.isEmpty && parent.path === parentPathOf(path);
  const isEmpty = hasOwnEmptyBrush || isParentEmpty;
  useEffect(() => {
    if (path === null || !isEmpty) return undefined;
    report(path);
    return () => clear(path);
  }, [path, isEmpty, report, clear]);
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
  return useContext(EmptyShapesContext).has(nodePath);
}
