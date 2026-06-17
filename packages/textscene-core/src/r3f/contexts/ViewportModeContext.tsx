/**
 * Viewport-mode seam (ADR-0006): the single source of truth for how the
 * center viewport displays the active scene.
 *
 * - `mode` — `'3D'` mounts the R3F canvas; `'2D'` mounts the Control overlay.
 * - `showCollisions` — drives the CollisionShape3D wireframe gizmos (off by
 *   default, like Godot's "Visible Collision Shapes").
 * - `showLabels` — drives in-viewport text (Label3D); off by default so text
 *   doesn't clutter the 3D view (ADR-0008), toggled on like the collision gizmo.
 *
 * The context has a safe default (3D, collisions off, labels off) so components
 * that read it render correctly even when no provider is mounted (test
 * scaffolding, and the off-by-default toggles). The toolbar toggle (P4) writes
 * through the provider; persistence is layered on top via a host-specific hook.
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
  showLabels: boolean;
  setShowLabels: (show: boolean) => void;
  showNavigation: boolean;
  setShowNavigation: (show: boolean) => void;
}

const DEFAULT_VALUE: ViewportModeValue = {
  mode: '3D',
  setMode: () => {},
  showCollisions: false,
  setShowCollisions: () => {},
  showLabels: false,
  setShowLabels: () => {},
  showNavigation: true,
  setShowNavigation: () => {},
};

const ViewportModeContext = createContext<ViewportModeValue>(DEFAULT_VALUE);
ViewportModeContext.displayName = 'ViewportModeContext';

export interface ViewportModeProviderProps {
  children: ReactNode;
  initialMode?: ViewportMode;
  initialShowCollisions?: boolean;
  initialShowLabels?: boolean;
  initialShowNavigation?: boolean;
}

export function ViewportModeProvider({
  children,
  initialMode = '3D',
  initialShowCollisions = false,
  initialShowLabels = false,
  initialShowNavigation = true,
}: ViewportModeProviderProps) {
  const [mode, setMode] = useState<ViewportMode>(initialMode);
  const [showCollisions, setShowCollisions] = useState(initialShowCollisions);
  const [showLabels, setShowLabels] = useState(initialShowLabels);
  const [showNavigation, setShowNavigation] = useState(initialShowNavigation);
  const value = useMemo<ViewportModeValue>(
    () => ({
      mode,
      setMode,
      showCollisions,
      setShowCollisions,
      showLabels,
      setShowLabels,
      showNavigation,
      setShowNavigation,
    }),
    [mode, showCollisions, showLabels, showNavigation]
  );
  return <ViewportModeContext.Provider value={value}>{children}</ViewportModeContext.Provider>;
}

/** Read the viewport mode + collision/label visibility state. Safe without a provider. */
export function useViewportMode(): ViewportModeValue {
  return useContext(ViewportModeContext);
}
