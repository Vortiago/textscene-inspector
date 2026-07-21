/**
 * Viewport-mode seam (ADR-0006): the single source of truth for how the
 * center viewport displays the active scene.
 *
 * - `mode` — `'3D'` mounts the R3F canvas; `'2D'` mounts the Control overlay.
 * - `showCollisions` — drives the CollisionShape3D wireframe gizmos (off by
 *   default, like Godot's "Visible Collision Shapes").
 * - `showLabels` — drives in-viewport text (Label3D); off by default so text
 *   doesn't clutter the 3D view (ADR-0008), toggled on like the collision gizmo.
 * - `showGrid` — a ground-plane grid helper in the 3D viewport. Off by
 *   default: a sibling hardening bucket regenerates ALL visual-regression
 *   baselines in this same round, so a toggle that's visible out of the box
 *   would invalidate that work. A user who turns it on gets it persisted
 *   (host-layered, like the mode itself) — only a FRESH session with no
 *   persisted preference sees it off.
 *
 * The context has a safe default (3D, collisions off, labels off, grid off)
 * so components that read it render correctly even when no provider is
 * mounted (test scaffolding, and the off-by-default toggles). The toolbar
 * toggle (P4) writes through the provider; persistence is layered on top via
 * a host-specific hook.
 */

import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

export type ViewportMode = '2D' | '3D';

/**
 * localStorage keys for the two persisted viewport preferences.
 * `<TscnPreviewShell>` reads them once to seed this provider;
 * `<ViewportToolbar>` writes them on an EXPLICIT user choice. Programmatic
 * mode changes (WorkspaceAutoSelect's typed-root pick, the Cameras panel's
 * 2D framing) deliberately do NOT persist — they are per-scene derivations,
 * not the user's preference, and writing them would clobber it.
 */
export const VIEWPORT_MODE_STORAGE_KEY = 'tsi.viewportMode';
export const SHOW_GRID_STORAGE_KEY = 'tsi.showGrid';
/**
 * Whether to frame the scene on load. OFF by default, which is Godot: its
 * editor opens every scene at a fixed orbit and leaves framing to F. That also
 * costs less to draw — a framed scene puts every object inside the frustum,
 * so nothing is culled.
 */
export const FRAME_ON_OPEN_STORAGE_KEY = 'tsi.frameOnOpen';

export interface ViewportModeValue {
  mode: ViewportMode;
  setMode: (mode: ViewportMode) => void;
  showCollisions: boolean;
  setShowCollisions: (show: boolean) => void;
  showLabels: boolean;
  setShowLabels: (show: boolean) => void;
  showNavigation: boolean;
  setShowNavigation: (show: boolean) => void;
  showGrid: boolean;
  setShowGrid: (show: boolean) => void;
  /**
   * The editor preview sun / preview environment (ADR-0025). On by default,
   * as in Godot, and forced off for whichever preview the scene supersedes —
   * these flags only say what the USER asked for.
   */
  showPreviewSun: boolean;
  setShowPreviewSun: (show: boolean) => void;
  showPreviewEnvironment: boolean;
  setShowPreviewEnvironment: (show: boolean) => void;
  /** Frame the scene to the viewport on load, instead of Godot's fixed orbit. */
  frameOnOpen: boolean;
  setFrameOnOpen: (frame: boolean) => void;
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
  showGrid: false,
  setShowGrid: () => {},
  showPreviewSun: true,
  setShowPreviewSun: () => {},
  showPreviewEnvironment: true,
  setShowPreviewEnvironment: () => {},
  frameOnOpen: false,
  setFrameOnOpen: () => {},
};

const ViewportModeContext = createContext<ViewportModeValue>(DEFAULT_VALUE);
ViewportModeContext.displayName = 'ViewportModeContext';

export interface ViewportModeProviderProps {
  children: ReactNode;
  initialMode?: ViewportMode;
  initialShowCollisions?: boolean;
  initialShowLabels?: boolean;
  initialShowNavigation?: boolean;
  initialShowGrid?: boolean;
  initialShowPreviewSun?: boolean;
  initialShowPreviewEnvironment?: boolean;
  initialFrameOnOpen?: boolean;
}

export function ViewportModeProvider({
  children,
  initialMode = '3D',
  initialShowCollisions = false,
  initialShowLabels = false,
  initialShowNavigation = true,
  initialShowGrid = false,
  initialShowPreviewSun = true,
  initialShowPreviewEnvironment = true,
  initialFrameOnOpen = false,
}: ViewportModeProviderProps) {
  const [mode, setMode] = useState<ViewportMode>(initialMode);
  const [showCollisions, setShowCollisions] = useState(initialShowCollisions);
  const [showLabels, setShowLabels] = useState(initialShowLabels);
  const [showNavigation, setShowNavigation] = useState(initialShowNavigation);
  const [showGrid, setShowGrid] = useState(initialShowGrid);
  const [showPreviewSun, setShowPreviewSun] = useState(initialShowPreviewSun);
  const [showPreviewEnvironment, setShowPreviewEnvironment] = useState(
    initialShowPreviewEnvironment
  );
  const [frameOnOpen, setFrameOnOpen] = useState(initialFrameOnOpen);
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
      showGrid,
      setShowGrid,
      showPreviewSun,
      setShowPreviewSun,
      showPreviewEnvironment,
      setShowPreviewEnvironment,
      frameOnOpen,
      setFrameOnOpen,
    }),
    [
      mode,
      showCollisions,
      showLabels,
      showNavigation,
      showGrid,
      showPreviewSun,
      showPreviewEnvironment,
      frameOnOpen,
    ]
  );
  return <ViewportModeContext.Provider value={value}>{children}</ViewportModeContext.Provider>;
}

/** Read the viewport mode + collision/label/grid visibility state. Safe without a provider. */
export function useViewportMode(): ViewportModeValue {
  return useContext(ViewportModeContext);
}
