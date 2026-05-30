/**
 * Viewport-mode seam (ADR-0006): the single source of truth for how the
 * center viewport displays the active scene.
 *
 * - `mode` — `'3D'` mounts the R3F canvas; `'2D'` mounts the Control overlay.
 * - `showCollisions` — drives the CollisionShape3D wireframe gizmos (off by
 *   default, like Godot's "Visible Collision Shapes").
 *
 * The context has a safe default (3D, collisions off) so components that read
 * it render correctly even when no provider is mounted (test scaffolding, and
 * the gizmo's off-by-default behavior). The toolbar toggle (P4) writes through
 * the provider; persistence is layered on top via a host-specific hook.
 */

import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

export type ViewportMode = '2D' | '3D';

export interface ViewportModeValue {
  mode: ViewportMode;
  setMode: (mode: ViewportMode) => void;
  showCollisions: boolean;
  setShowCollisions: (show: boolean) => void;
}

const DEFAULT_VALUE: ViewportModeValue = {
  mode: '3D',
  setMode: () => {},
  showCollisions: false,
  setShowCollisions: () => {},
};

const ViewportModeContext = createContext<ViewportModeValue>(DEFAULT_VALUE);
ViewportModeContext.displayName = 'ViewportModeContext';

export interface ViewportModeProviderProps {
  children: ReactNode;
  initialMode?: ViewportMode;
  initialShowCollisions?: boolean;
}

export function ViewportModeProvider({
  children,
  initialMode = '3D',
  initialShowCollisions = false,
}: ViewportModeProviderProps) {
  const [mode, setMode] = useState<ViewportMode>(initialMode);
  const [showCollisions, setShowCollisions] = useState(initialShowCollisions);
  const value = useMemo<ViewportModeValue>(
    () => ({ mode, setMode, showCollisions, setShowCollisions }),
    [mode, showCollisions]
  );
  return <ViewportModeContext.Provider value={value}>{children}</ViewportModeContext.Provider>;
}

/** Read the viewport mode + collision-visibility state. Safe without a provider. */
export function useViewportMode(): ViewportModeValue {
  return useContext(ViewportModeContext);
}
