import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { readPersisted } from '../../hooks/usePersistedState.js';
import { DEFAULT_SHOW, withShown, type ViewShow } from '../../viewShow/viewShow.js';
import type { ViewportMode } from '../../viewportMode.js';

export type { ViewportMode } from '../../viewportMode.js';

/**
 * The localStorage keys of the persisted viewport preferences. The shell
 * reads them once. `<ViewportToolbar>` writes them on a user choice, and a
 * programmatic change, a per-scene derivation, never persists.
 */
export const VIEWPORT_MODE_STORAGE_KEY = 'tsi.viewportMode';
/**
 * Whether to frame the scene on load. Off by default, as Godot's editor opens
 * at a fixed orbit. A framed scene also puts every object in the frustum, so
 * nothing is culled.
 */
export const FRAME_ON_OPEN_STORAGE_KEY = 'tsi.frameOnOpen';
/** The helpers a session keeps. A user who hides the fog for speed keeps it hidden on the next open. */
export const SHOW_STORAGE_KEYS = {
  gizmos: 'tsi.showGizmos',
  grid: 'tsi.showGrid',
  fog: 'tsi.showFog',
  performance: 'tsi.showPerformance',
} as const satisfies Partial<Record<keyof ViewShow, string>>;

export type PersistedShowKey = keyof typeof SHOW_STORAGE_KEYS;

export function isPersistedShowKey(key: string): key is PersistedShowKey {
  return key in SHOW_STORAGE_KEYS;
}

/** The viewport preferences a session persists, read once to seed the provider. */
export interface PersistedViewport {
  mode: ViewportMode;
  show: Partial<ViewShow>;
  frameOnOpen: boolean;
}

/** The preferences of a session that persisted none: 3D, the default helpers, Godot's fixed orbit. */
export const DEFAULT_VIEWPORT: PersistedViewport = {
  mode: '3D',
  show: DEFAULT_SHOW,
  frameOnOpen: false,
};

function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

function isViewportMode(value: unknown): value is ViewportMode {
  return value === '2D' || value === '3D' || value === 'in-game';
}

/** The preferences of the last session. A persisted value of an unexpected shape takes its default. */
export function readPersistedViewport(): PersistedViewport {
  return {
    mode: readPersisted(VIEWPORT_MODE_STORAGE_KEY, DEFAULT_VIEWPORT.mode, isViewportMode),
    show: Object.fromEntries(
      Object.entries(SHOW_STORAGE_KEYS).map(([key, storageKey]) => [
        key,
        readPersisted(storageKey, DEFAULT_SHOW[key as PersistedShowKey], isBoolean),
      ])
    ),
    frameOnOpen: readPersisted(FRAME_ON_OPEN_STORAGE_KEY, DEFAULT_VIEWPORT.frameOnOpen, isBoolean),
  };
}

/** The toolbar's state: the shell hands `mode` and `show` to the view. */
interface ViewportModeValue {
  mode: ViewportMode;
  setMode: (mode: ViewportMode) => void;
  show: ViewShow;
  /** Changes only the keys given. */
  setShow: (show: Partial<ViewShow>) => void;
  /** Frame the scene to the viewport on load, instead of Godot's fixed orbit. */
  frameOnOpen: boolean;
  setFrameOnOpen: (frame: boolean) => void;
}

const DEFAULT_VALUE: ViewportModeValue = {
  ...DEFAULT_VIEWPORT,
  show: DEFAULT_SHOW,
  setMode: () => {},
  setShow: () => {},
  setFrameOnOpen: () => {},
};

const ViewportModeContext = createContext<ViewportModeValue>(DEFAULT_VALUE);
ViewportModeContext.displayName = 'ViewportModeContext';

export interface ViewportModeProviderProps {
  children: ReactNode;
  initialMode?: ViewportMode;
  /** A key left out has its default. */
  initialShow?: Partial<ViewShow>;
  initialFrameOnOpen?: boolean;
}

export function ViewportModeProvider({
  children,
  initialMode = DEFAULT_VIEWPORT.mode,
  initialShow,
  initialFrameOnOpen = DEFAULT_VIEWPORT.frameOnOpen,
}: ViewportModeProviderProps) {
  const [mode, setMode] = useState<ViewportMode>(initialMode);
  const [show, setWholeShow] = useState(() => withShown(DEFAULT_SHOW, initialShow));
  const [frameOnOpen, setFrameOnOpen] = useState(initialFrameOnOpen);
  const value = useMemo<ViewportModeValue>(
    () => ({
      mode,
      setMode,
      show,
      setShow: (given) => setWholeShow((current) => withShown(current, given)),
      frameOnOpen,
      setFrameOnOpen,
    }),
    [mode, show, frameOnOpen]
  );
  return <ViewportModeContext.Provider value={value}>{children}</ViewportModeContext.Provider>;
}

/** Safe without a provider. */
export function useViewportMode(): ViewportModeValue {
  return useContext(ViewportModeContext);
}
