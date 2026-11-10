/**
 * The size in pixels of the viewport that a node renders in: the nearest SubViewport above it,
 * else the project's `display/window/size/viewport_*`. Godot reads the same size for an editor
 * gizmo that depends on it (`Node3DEditor::get_camera_viewport_size`). `ViewportRectContext` cannot
 * serve it: that holds a forced rect by SubViewport path, with no lookup from a descendant.
 */
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { Vector2 } from '../../godot/math/vector';
import { useProjectSettings } from './ProjectSettingsContext';

/** What a viewport knows of its size and of the viewport around it. Null: no SubViewport above. */
interface ViewportSizes {
  size: Vector2;
  /** The size of the viewport this one sits in, or null where the project's viewport is that. */
  embedder: Vector2 | null;
}

const ViewportSizeContext = createContext<ViewportSizes | null>(null);
ViewportSizeContext.displayName = 'ViewportSizeContext';

export function ViewportSizeProvider({ size, children }: { size: Vector2; children: ReactNode }) {
  const embedder = useContext(ViewportSizeContext)?.size ?? null;
  const value = useMemo(() => ({ size, embedder }), [size, embedder]);
  return <ViewportSizeContext.Provider value={value}>{children}</ViewportSizeContext.Provider>;
}

/** The project's `display/window/size/viewport_*`, with one identity so an effect that lists it does not resubscribe each render. */
function useProjectViewportSize(): Vector2 {
  const { viewportSize } = useProjectSettings();
  return useMemo(
    () => ({ x: viewportSize.width, y: viewportSize.height }),
    [viewportSize.width, viewportSize.height]
  );
}

/** @canonical The size of the viewport that a node renders in */
export function useViewportSize(): Vector2 {
  const enclosing = useContext(ViewportSizeContext);
  const projectSize = useProjectViewportSize();
  return enclosing?.size ?? projectSize;
}

/** The size of the viewport around the one a node renders in: what a window embeds in. */
export function useEmbedderViewportSize(): Vector2 {
  const enclosing = useContext(ViewportSizeContext);
  const projectSize = useProjectViewportSize();
  return enclosing?.embedder ?? projectSize;
}
