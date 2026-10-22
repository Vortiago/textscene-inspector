/** The draw order a selection-gated gizmo uses, for the lines and the fills alike. */

/** Render order for selection-gated gizmos, above ordinary scene content. */
export const GIZMO_RENDER_ORDER = 10;

/**
 * The group order a gizmo draws at, above every canvas item. A gizmo is editor
 * chrome, not a CanvasItem, and three compares the nearest group's order first,
 * so at its node's canvas key it would fall behind anything authored after it.
 */
export const GIZMO_GROUP_ORDER = Number.MAX_SAFE_INTEGER;
