/**
 * The size in pixels of the viewport that a node renders in: the nearest SubViewport above it,
 * else the project's `display/window/size/viewport_*`. Godot reads the same size for an editor
 * gizmo that depends on it (`Node3DEditor::get_camera_viewport_size`). `ViewportRectContext` cannot
 * serve it: that holds a forced rect by SubViewport path, with no lookup from a descendant.
 */
import { createContext, useContext, type ReactNode } from 'react';
import type { Vector2 } from '../../godot/math/vector';
import { useProjectSettings } from './ProjectSettingsContext';

/** Null: no SubViewport above, so the project's size holds. */
const ViewportSizeContext = createContext<Vector2 | null>(null);
ViewportSizeContext.displayName = 'ViewportSizeContext';

export function ViewportSizeProvider({ size, children }: { size: Vector2; children: ReactNode }) {
  return <ViewportSizeContext.Provider value={size}>{children}</ViewportSizeContext.Provider>;
}

/** @canonical The size of the viewport that a node renders in */
export function useViewportSize(): Vector2 {
  const enclosing = useContext(ViewportSizeContext);
  const { viewportSize } = useProjectSettings();
  return enclosing ?? { x: viewportSize.width, y: viewportSize.height };
}
