/**
 * The group every selection-gated gizmo draws in: tagged as editor chrome, and ordered above
 * ordinary scene content and every canvas item.
 */

import { useMemo, type ReactNode } from 'react';
import { editorHelperUserData } from '../editorHelpers';

/** Render order for the lines and fills of a gizmo, above ordinary scene content. */
export const GIZMO_RENDER_ORDER = 10;

/**
 * The group order a gizmo draws at, above every canvas item. A gizmo is editor
 * chrome, not a CanvasItem, and three compares the nearest group's order first,
 * so at its node's canvas key it would fall behind anything authored after it.
 */
const GIZMO_GROUP_ORDER = Number.MAX_SAFE_INTEGER;

export function GizmoGroup({ children }: { children: ReactNode }) {
  // Memoised, as R3F assigns a new `userData` object on each render.
  const helperUserData = useMemo(editorHelperUserData, []);
  return (
    <group renderOrder={GIZMO_GROUP_ORDER} userData={helperUserData}>
      {children}
    </group>
  );
}
