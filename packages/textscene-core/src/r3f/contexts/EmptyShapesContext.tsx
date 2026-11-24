import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { parentPathOf } from '../../utils/nodePath.js';
import { useUndrawnReport } from '../viewStatus/useUndrawnReport.js';
import { useNodePath } from './NodePathContext.js';

/** The nearest enclosing CSG shape, which a child checks against its own parent path. */
interface ParentShape {
  path: string;
  isEmpty: boolean;
}

const ParentShapeContext = createContext<ParentShape | null>(null);
ParentShapeContext.displayName = 'ParentShapeContext';

/** Reports the node while its own brush or its direct CSG parent's shape is empty (csg_shape.cpp:977-988). */
export function useReportEmptyShape(hasOwnEmptyBrush: boolean): boolean {
  const path = useNodePath();
  const parent = useContext(ParentShapeContext);
  const isParentEmpty =
    parent !== null && path !== null && parent.isEmpty && parent.path === parentPathOf(path);
  const isEmpty = hasOwnEmptyBrush || isParentEmpty;
  useUndrawnReport(isEmpty ? 'empty-shape' : null);
  return isEmpty;
}

/** Tells the shapes below whether the enclosing node's shape is empty. */
export function EmptyShapeBranch({ isEmpty, children }: { isEmpty: boolean; children?: ReactNode }) {
  const path = useNodePath();
  const parent = useMemo(() => (path === null ? null : { path, isEmpty }), [path, isEmpty]);
  return <ParentShapeContext.Provider value={parent}>{children}</ParentShapeContext.Provider>;
}
