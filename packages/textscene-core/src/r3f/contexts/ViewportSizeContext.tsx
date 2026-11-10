/**
 * The size in pixels of the viewport that a node renders in: the nearest SubViewport above it,
 * else the project's `display/window/size/viewport_*`. Godot reads the same size for an editor
 * gizmo that depends on it (`Node3DEditor::get_camera_viewport_size`). `ViewportRectContext` cannot
 * serve it: that holds a forced rect by SubViewport path, with no lookup from a descendant.
 */
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { Vector2 } from '../../godot/math/vector';
import { useProjectSettings } from './ProjectSettingsContext';

/** What a viewport knows of its size and of the viewports its windows embed in. Null: no SubViewport above. */
interface ViewportSizes {
  size: Vector2;
  /** The size of the viewport this one's own window embeds in, or null where the project's viewport is that. */
  embedder: Vector2 | null;
  /** The size of the viewport a window below this one embeds in: this viewport if it embeds subwindows, else its own embedder. */
  windowsEmbedIn: Vector2 | null;
}

const ViewportSizeContext = createContext<ViewportSizes | null>(null);
ViewportSizeContext.displayName = 'ViewportSizeContext';

interface ViewportSizeProviderProps {
  size: Vector2;
  /** The viewport's `gui_embed_subwindows` (`Window::get_embedder` climbs past a viewport without it, `window.cpp:1400-1415`). */
  embedsWindows?: boolean;
  children: ReactNode;
}

export function ViewportSizeProvider({ size, embedsWindows = false, children }: ViewportSizeProviderProps) {
  const embedder = useContext(ViewportSizeContext)?.windowsEmbedIn ?? null;
  const value = useMemo(
    () => ({ size, embedder, windowsEmbedIn: embedsWindows ? size : embedder }),
    [size, embedder, embedsWindows]
  );
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

/** The size of the viewport a window at this node embeds in (`Window::get_embedder`): the nearest viewport above that embeds subwindows. */
export function useEmbedderViewportSize(): Vector2 {
  const enclosing = useContext(ViewportSizeContext);
  const projectSize = useProjectViewportSize();
  return enclosing?.embedder ?? projectSize;
}
