/**
 * How the centre viewport shows the scene (ADR-0006). `'3D'` mounts the R3F
 * canvas, `'2D'` the Control overlay. The default (3D, collisions off, labels
 * on, grid off) needs no provider, and the host layers persistence on top.
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
 * The localStorage keys of the persisted viewport preferences. The shell
 * reads them once. `<ViewportToolbar>` writes them on a user choice, and a
 * programmatic change, a per-scene derivation, never persists.
 */
export const VIEWPORT_MODE_STORAGE_KEY = 'tsi.viewportMode';
export const SHOW_GRID_STORAGE_KEY = 'tsi.showGrid';
/**
 * Whether to frame the scene on load. Off by default, as Godot's editor opens
 * at a fixed orbit. A framed scene also puts every object in the frustum, so
 * nothing is culled.
 */
export const FRAME_ON_OPEN_STORAGE_KEY = 'tsi.frameOnOpen';

export interface ViewportModeValue {
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
}

const DEFAULT_VALUE: ViewportModeValue = {
  mode: '3D',
  setMode: () => {},
  showCollisions: false,
  setShowCollisions: () => {},
  showLabels: true,
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
  initialShowLabels = true,
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

/** The viewport mode and the overlay toggles. Safe without a provider. */
export function useViewportMode(): ViewportModeValue {
  return useContext(ViewportModeContext);
}
