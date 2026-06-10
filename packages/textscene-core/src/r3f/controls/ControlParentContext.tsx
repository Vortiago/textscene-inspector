/**
 * Tells each Control component what kind of layout its parent imposes, so it can
 * position itself correctly (a child of a VBoxContainer is a flex item; a child
 * of a plain Control / the overlay root is anchored/absolute). Container
 * components provide their own kind to their subtree; everything else resets to
 * 'free'. Mirrors the dispatcher-provides-context pattern of NodePathContext.
 */

import { createContext, useContext, type ReactNode } from 'react';
import type { ParentLayoutKind } from './controlLayout';

const ControlParentContext = createContext<ParentLayoutKind>('free');
ControlParentContext.displayName = 'ControlParentContext';

export function ControlParentProvider({
  kind,
  children,
}: {
  kind: ParentLayoutKind;
  children: ReactNode;
}) {
  return <ControlParentContext.Provider value={kind}>{children}</ControlParentContext.Provider>;
}

/** The layout regime imposed by the nearest enclosing container ('free' at the root). */
export function useControlParent(): ParentLayoutKind {
  return useContext(ControlParentContext);
}
