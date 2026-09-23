/**
 * The controls over the viewport: Reset Camera and Screenshot in 3D, the 3D/2D
 * switch, and the display toggles in `<DisplayMenu>`. It writes through
 * `useViewportMode()`. Screenshot downloads a PNG through the handler that
 * `<TscnCanvas>`'s `ScreenshotBridge` registers.
 */

import {
  useViewportMode,
  FRAME_ON_OPEN_STORAGE_KEY,
  SHOW_GRID_STORAGE_KEY,
  VIEWPORT_MODE_STORAGE_KEY,
  type ViewportMode,
} from '../../contexts/ViewportModeContext.js';
import { useOptionalCameraControl } from '../../contexts/CameraControlContext.js';
import { useOptionalHierarchy } from '../../contexts/HierarchyContext.js';
import { writePersisted } from '../../hooks/usePersistedState.js';
import { useLiveSceneNodes } from '../../useLiveSceneTree.js';
import {
  PREVIEW_ENVIRONMENT_YIELD_TYPE,
  PREVIEW_SUN_YIELD_TYPE,
  YIELDS_A_PREVIEW,
} from '../../preview/godotPreviewLighting.js';
import { DisplayMenu, type DisplayToggle } from './DisplayMenu.js';
import styles from './ViewportToolbar.module.css';

const MODES: ViewportMode[] = ['3D', '2D'];

/** Everything `buildDisplayToggles` needs, so a test needs no DOM. */
export interface DisplayToggleState {
  mode: ViewportMode;
  showCollisions: boolean;
  setShowCollisions: (show: boolean) => void;
  showLabels: boolean;
  setShowLabels: (show: boolean) => void;
  showNavigation: boolean;
  setShowNavigation: (show: boolean) => void;
  showGrid: boolean;
  setShowGrid: (show: boolean) => void;
  showPreviewSun: boolean;
  setShowPreviewSun: (show: boolean) => void;
  showPreviewEnvironment: boolean;
  setShowPreviewEnvironment: (show: boolean) => void;
  frameOnOpen: boolean;
  setFrameOnOpen: (frame: boolean) => void;
  sceneHasSun: boolean;
  sceneHasEnvironment: boolean;
}

/**
 * The overlays the Display menu offers, and their state. At module scope, so
 * the 3D-only ones are one readable list.
 */
export function buildDisplayToggles(state: DisplayToggleState): readonly DisplayToggle[] {
  return [
    {
      label: 'Collisions',
      title: 'Show CollisionShape3D wireframes',
      checked: state.showCollisions,
      onChange: state.setShowCollisions,
    },
    {
      label: 'Labels',
      title: 'Show Label3D text in the viewport',
      checked: state.showLabels,
      onChange: state.setShowLabels,
    },
    {
      label: 'Navigation',
      title: 'Show NavigationRegion overlays',
      checked: state.showNavigation,
      onChange: state.setShowNavigation,
    },
    // 3D-only: the grid, the framing preference and both preview-lighting
    // stand-ins have no meaning over the 2D Control overlay.
    ...(state.mode === '3D'
      ? ([
          {
            label: 'Frame on open',
            title:
              'Frame the whole scene when it loads. Off matches Godot, which opens at a fixed orbit — press F to frame.',
            checked: state.frameOnOpen,
            onChange: state.setFrameOnOpen,
          },
          {
            label: 'Grid',
            title: 'Show a ground-plane reference grid',
            checked: state.showGrid,
            onChange: state.setShowGrid,
          },
          {
            label: 'Preview Sun',
            title: state.sceneHasSun
              ? 'Scene contains DirectionalLight3D. Preview disabled.'
              : "Godot's editor preview sun, for a scene with no light of its own",
            checked: state.showPreviewSun && !state.sceneHasSun,
            disabled: state.sceneHasSun,
            onChange: state.setShowPreviewSun,
          },
          {
            label: 'Preview Sky',
            title: state.sceneHasEnvironment
              ? 'Scene contains WorldEnvironment. Preview disabled.'
              : "Godot's editor preview sky, for a scene with no environment of its own",
            checked: state.showPreviewEnvironment && !state.sceneHasEnvironment,
            disabled: state.sceneHasEnvironment,
            onChange: state.setShowPreviewEnvironment,
          },
        ] satisfies DisplayToggle[])
      : []),
  ];
}

/** Downloads a data URL through a throwaway anchor element. */
function downloadDataUrl(dataUrl: string, filename: string): void {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

export function ViewportToolbar() {
  const {
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
  } = useViewportMode();
  const camera = useOptionalCameraControl();
  const hierarchy = useOptionalHierarchy();
  const sceneLoaded = Boolean(hierarchy?.sceneGraph);

  // Godot disables a preview button, with the reason in its label, once the
  // scene supplies its own, so no preview doubles the scene's light (ADR-0025).
  const yielding = useLiveSceneNodes(YIELDS_A_PREVIEW);
  const sceneHasSun = yielding.some((entry) => entry.node.type === PREVIEW_SUN_YIELD_TYPE);
  const sceneHasEnvironment = yielding.some(
    (entry) => entry.node.type === PREVIEW_ENVIRONMENT_YIELD_TYPE
  );

  function handleScreenshot() {
    const dataUrl = camera?.takeScreenshot();
    if (!dataUrl) return;
    downloadDataUrl(dataUrl, `tscn-preview-${Date.now()}.png`);
  }

  // Only the user's click persists: a programmatic writer, such as
  // WorkspaceAutoSelect, must not overwrite the stored preference.
  function handleModeClick(m: ViewportMode) {
    setMode(m);
    writePersisted(VIEWPORT_MODE_STORAGE_KEY, m);
  }
  function handleGridChange(show: boolean) {
    setShowGrid(show);
    writePersisted(SHOW_GRID_STORAGE_KEY, show);
  }
  function handleFrameOnOpenChange(frame: boolean) {
    setFrameOnOpen(frame);
    writePersisted(FRAME_ON_OPEN_STORAGE_KEY, frame);
  }

  const displayToggles = buildDisplayToggles({
    mode,
    showCollisions,
    setShowCollisions,
    showLabels,
    setShowLabels,
    showNavigation,
    setShowNavigation,
    showGrid,
    setShowGrid: handleGridChange,
    showPreviewSun,
    setShowPreviewSun,
    showPreviewEnvironment,
    setShowPreviewEnvironment,
    frameOnOpen,
    setFrameOnOpen: handleFrameOnOpenChange,
    sceneHasSun,
    sceneHasEnvironment,
  });

  return (
    <div className={styles.toolbar} role="toolbar" aria-label="Viewport controls">
      {/* Reset Camera orbits in 3D, so it hides in 2D. */}
      {mode === '3D' && camera && (
        <button
          type="button"
          className={styles.resetButton}
          onClick={camera.resetCamera}
          disabled={!sceneLoaded}
          data-testid="reset-camera-button"
          title="Frame the orbit camera back to the default view"
        >
          Reset Camera
        </button>
      )}
      {mode === '3D' && camera && (
        <button
          type="button"
          className={styles.resetButton}
          onClick={handleScreenshot}
          disabled={!sceneLoaded}
          data-testid="screenshot-button"
          title="Save the current 3D view as a PNG"
        >
          Screenshot
        </button>
      )}
      <div className={styles.segment} role="group" aria-label="Viewport dimension">
        {MODES.map((m) => (
          <button
            key={m}
            type="button"
            className={m === mode ? `${styles.segmentButton} ${styles.active}` : styles.segmentButton}
            aria-pressed={m === mode}
            onClick={() => handleModeClick(m)}
          >
            {m}
          </button>
        ))}
      </div>
      <DisplayMenu toggles={displayToggles} />
    </div>
  );
}
