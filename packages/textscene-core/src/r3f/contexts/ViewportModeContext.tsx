/**
 * How the centre viewport shows the scene (ADR-0006). `'3D'` mounts the R3F
 * canvas, `'2D'` the Control overlay. The default (3D, collisions off, labels
 * on, gizmos on, grid off, fog on, performance off) needs no provider, and the host layers
 * persistence on top.
 */

import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

export type ViewportMode = '2D' | '3D';

/**
 * The localStorage keys of the persisted viewport preferences. The shell
 * reads them once. `<ViewportToolbar>` writes them on a user choice, and a
 * programmatic change, a per-scene derivation, never persists.
 */
export const VIEWPORT_MODE_STORAGE_KEY = 'tsi.viewportMode';
export const SHOW_GRID_STORAGE_KEY = 'tsi.showGrid';
export const SHOW_GIZMOS_STORAGE_KEY = 'tsi.showGizmos';
/**
 * Whether to frame the scene on load. Off by default, as Godot's editor opens
 * at a fixed orbit. A framed scene also puts every object in the frustum, so
 * nothing is culled.
 */
export const FRAME_ON_OPEN_STORAGE_KEY = 'tsi.frameOnOpen';
/** Whether to draw the fog. A user who hides it for speed keeps it hidden on the next open. */
export const SHOW_FOG_STORAGE_KEY = 'tsi.showFog';
export const SHOW_PERFORMANCE_STORAGE_KEY = 'tsi.showPerformance';

/** The viewport preferences a session persists, read once to seed the provider. */
export interface PersistedViewport {
  mode: ViewportMode;
  showGizmos: boolean;
  showGrid: boolean;
  frameOnOpen: boolean;
  showFog: boolean;
  showPerformance: boolean;
}

/** The preferences of a session that persisted none: 3D, gizmos on, no grid, Godot's fixed orbit, fog on. */
export const DEFAULT_VIEWPORT: PersistedViewport = {
  mode: '3D',
  showGizmos: true,
  showGrid: false,
  frameOnOpen: false,
  showFog: true,
  showPerformance: false,
};

interface ViewportModeValue {
  mode: ViewportMode;
  setMode: (mode: ViewportMode) => void;
  /** The CollisionShape3D gizmos, off by default like Godot's "Visible Collision Shapes". */
  showCollisions: boolean;
  setShowCollisions: (show: boolean) => void;
  /** Label3D text, on by default, since Godot always rasterises it (ADR-0008 amendment). */
  showLabels: boolean;
  setShowLabels: (show: boolean) => void;
  showNavigation: boolean;
  setShowNavigation: (show: boolean) => void;
  /**
   * Every editor gizmo, 2D helpers included, on by default like Godot's "View Gizmos"
   * (`node_3d_editor_plugin.cpp:6255,6266`). Collision gizmos follow `showCollisions` alone.
   */
  showGizmos: boolean;
  setShowGizmos: (show: boolean) => void;
  /** A ground-plane grid in 3D, off by default, or it lands in every golden. A user's choice persists. */
  showGrid: boolean;
  setShowGrid: (show: boolean) => void;
  /**
   * The editor preview sun and environment (ADR-0025), on by default as in
   * Godot. The scene can force one off, so these flags say only what the user asked for.
   */
  showPreviewSun: boolean;
  setShowPreviewSun: (show: boolean) => void;
  showPreviewEnvironment: boolean;
  setShowPreviewEnvironment: (show: boolean) => void;
  /** Frame the scene to the viewport on load, instead of Godot's fixed orbit. */
  frameOnOpen: boolean;
  setFrameOnOpen: (frame: boolean) => void;
  /** The Environment's depth and volumetric fog, on by default as Godot draws it. Off skips its passes. */
  showFog: boolean;
  setShowFog: (show: boolean) => void;
  /** The performance overlay, off by default, since only a running frame profile fills it. */
  showPerformance: boolean;
  setShowPerformance: (show: boolean) => void;
}

const DEFAULT_VALUE: ViewportModeValue = {
  ...DEFAULT_VIEWPORT,
  setMode: () => {},
  showCollisions: false,
  setShowCollisions: () => {},
  showLabels: true,
  setShowLabels: () => {},
  showNavigation: true,
  setShowNavigation: () => {},
  setShowGizmos: () => {},
  setShowGrid: () => {},
  showPreviewSun: true,
  setShowPreviewSun: () => {},
  showPreviewEnvironment: true,
  setShowPreviewEnvironment: () => {},
  setFrameOnOpen: () => {},
  setShowFog: () => {},
  setShowPerformance: () => {},
};

const ViewportModeContext = createContext<ViewportModeValue>(DEFAULT_VALUE);
ViewportModeContext.displayName = 'ViewportModeContext';

/**
 * The Gizmos toggle on its own. Every node with a gizmo reads it, and a node that read the whole
 * viewport value would re-render on each grid, fog or label change.
 */
const ShowGizmosContext = createContext(DEFAULT_VIEWPORT.showGizmos);
ShowGizmosContext.displayName = 'ShowGizmosContext';

export interface ViewportModeProviderProps {
  children: ReactNode;
  initialMode?: ViewportMode;
  initialShowCollisions?: boolean;
  initialShowLabels?: boolean;
  initialShowNavigation?: boolean;
  initialShowGizmos?: boolean;
  initialShowGrid?: boolean;
  initialShowPreviewSun?: boolean;
  initialShowPreviewEnvironment?: boolean;
  initialFrameOnOpen?: boolean;
  initialShowFog?: boolean;
  initialShowPerformance?: boolean;
}

export function ViewportModeProvider({
  children,
  initialMode = DEFAULT_VIEWPORT.mode,
  initialShowCollisions = false,
  initialShowLabels = true,
  initialShowNavigation = true,
  initialShowGizmos = DEFAULT_VIEWPORT.showGizmos,
  initialShowGrid = DEFAULT_VIEWPORT.showGrid,
  initialShowPreviewSun = true,
  initialShowPreviewEnvironment = true,
  initialFrameOnOpen = DEFAULT_VIEWPORT.frameOnOpen,
  initialShowFog = DEFAULT_VIEWPORT.showFog,
  initialShowPerformance = DEFAULT_VIEWPORT.showPerformance,
}: ViewportModeProviderProps) {
  const [mode, setMode] = useState<ViewportMode>(initialMode);
  const [showCollisions, setShowCollisions] = useState(initialShowCollisions);
  const [showLabels, setShowLabels] = useState(initialShowLabels);
  const [showNavigation, setShowNavigation] = useState(initialShowNavigation);
  const [showGizmos, setShowGizmos] = useState(initialShowGizmos);
  const [showGrid, setShowGrid] = useState(initialShowGrid);
  const [showPreviewSun, setShowPreviewSun] = useState(initialShowPreviewSun);
  const [showPreviewEnvironment, setShowPreviewEnvironment] = useState(initialShowPreviewEnvironment);
  const [frameOnOpen, setFrameOnOpen] = useState(initialFrameOnOpen);
  const [showFog, setShowFog] = useState(initialShowFog);
  const [showPerformance, setShowPerformance] = useState(initialShowPerformance);
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
      showGizmos,
      setShowGizmos,
      showGrid,
      setShowGrid,
      showPreviewSun,
      setShowPreviewSun,
      showPreviewEnvironment,
      setShowPreviewEnvironment,
      frameOnOpen,
      setFrameOnOpen,
      showFog,
      setShowFog,
      showPerformance,
      setShowPerformance,
    }),
    [
      mode,
      showCollisions,
      showLabels,
      showNavigation,
      showGizmos,
      showGrid,
      showPreviewSun,
      showPreviewEnvironment,
      frameOnOpen,
      showFog,
      showPerformance,
    ]
  );
  return (
    <ViewportModeContext.Provider value={value}>
      <ShowGizmosContext.Provider value={showGizmos}>{children}</ShowGizmosContext.Provider>
    </ViewportModeContext.Provider>
  );
}

/** The viewport mode and the overlay toggles. Safe without a provider. */
export function useViewportMode(): ViewportModeValue {
  return useContext(ViewportModeContext);
}

/**
 * Whether the editor gizmos draw. Every other toggle reads `useViewportMode()`. This one has a context of
 * its own, so a gizmo re-renders for the Gizmos toggle alone.
 */
export function useShowGizmos(): boolean {
  return useContext(ShowGizmosContext);
}
