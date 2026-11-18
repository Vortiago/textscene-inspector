import {
  useViewportMode,
  RUNNING_GAME_TOGGLES,
  FRAME_ON_OPEN_STORAGE_KEY,
  SHOW_FOG_STORAGE_KEY,
  SHOW_GIZMOS_STORAGE_KEY,
  SHOW_GRID_STORAGE_KEY,
  SHOW_PERFORMANCE_STORAGE_KEY,
  VIEWPORT_MODE_STORAGE_KEY,
  type ViewportMode,
} from '../../contexts/ViewportModeContext.js';
import {
  useIsFreelookAvailable,
  useIsFreelookToggled,
  useOptionalViewportActions,
} from '../../contexts/ViewportActionsContext.js';
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

const MODES: ViewportMode[] = ['3D', '2D', 'in-game'];

const MODE_LABELS: Record<ViewportMode, string> = { '3D': '3D', '2D': '2D', 'in-game': 'In-game' };

const FREELOOK_TITLE =
  'Fly through the scene: the mouse looks around and W A S D move (Shift+F). Escape leaves.';
/** Godot ignores navigation while it previews a camera, and the button says so, as its preview buttons do. */
const FREELOOK_PREVIEW_TITLE = 'Freelook is off during a camera preview';
const FREELOOK_ORTHOGRAPHIC_TITLE = 'Freelook needs the perspective view (Numpad 5)';

function freelookTitle(isPreviewing: boolean, isAvailable: boolean): string {
  if (isPreviewing) return FREELOOK_PREVIEW_TITLE;
  return isAvailable ? FREELOOK_TITLE : FREELOOK_ORTHOGRAPHIC_TITLE;
}

/** Everything `buildDisplayToggles` needs, so a test needs no DOM. */
interface DisplayToggleState {
  mode: ViewportMode;
  showGizmos: boolean;
  setShowGizmos: (show: boolean) => void;
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
  showFog: boolean;
  setShowFog: (show: boolean) => void;
  showPerformance: boolean;
  setShowPerformance: (show: boolean) => void;
  sceneHasSun: boolean;
  sceneHasEnvironment: boolean;
}

const NO_EFFECT_IN_GAME_TITLE = 'No effect in the In-game view, which draws as the game does';

/** A Display toggle the running game overrides, disabled In-game. It keeps the user's value. */
function editorOnlyToggle(mode: ViewportMode, toggle: DisplayToggle): DisplayToggle {
  return mode === 'in-game' ? { ...toggle, title: NO_EFFECT_IN_GAME_TITLE, disabled: true } : toggle;
}

/**
 * The overlays the Display menu offers, and their state. At module scope, so
 * the 3D-only ones are one readable list.
 */
function buildDisplayToggles(state: DisplayToggleState): readonly DisplayToggle[] {
  // The key is the setting the toggle shows: only a setting the running game overrides compiles.
  const editorOnly = (_setting: keyof typeof RUNNING_GAME_TOGGLES, toggle: DisplayToggle) =>
    editorOnlyToggle(state.mode, toggle);
  return [
    editorOnly('showGizmos', {
      label: 'Gizmos',
      title: "Show the editor gizmos, faint on a node that is not selected, as Godot's View Gizmos does",
      checked: state.showGizmos,
      onChange: state.setShowGizmos,
    }),
    editorOnly('showCollisions', {
      label: 'Collisions',
      title: 'Show CollisionShape3D wireframes',
      checked: state.showCollisions,
      onChange: state.setShowCollisions,
    }),
    editorOnly('showLabels', {
      label: 'Labels',
      title: 'Show Label3D text in the viewport',
      checked: state.showLabels,
      onChange: state.setShowLabels,
    }),
    editorOnly('showNavigation', {
      label: 'Navigation',
      title: 'Show NavigationRegion overlays',
      checked: state.showNavigation,
      onChange: state.setShowNavigation,
    }),
    {
      label: 'Performance',
      title: 'Show the frame rate and the time each render step takes',
      checked: state.showPerformance,
      onChange: state.setShowPerformance,
    },
    // The grid, the framing, the fog and the preview lighting mean nothing over the 2D Control overlay.
    ...(state.mode === '2D'
      ? []
      : [
          editorOnly('frameOnOpen', {
            label: 'Frame on open',
            title:
              'Frame the whole scene when it loads. Off matches Godot, which opens at a fixed orbit — press F to frame.',
            checked: state.frameOnOpen,
            onChange: state.setFrameOnOpen,
          }),
          editorOnly('showGrid', {
            label: 'Grid',
            title: 'Show a ground-plane reference grid',
            checked: state.showGrid,
            onChange: state.setShowGrid,
          }),
          editorOnly('showFog', {
            label: 'Fog',
            title: "Draw the Environment's depth and volumetric fog. Off skips the fog passes.",
            checked: state.showFog,
            onChange: state.setShowFog,
          }),
          editorOnly('showPreviewSun', {
            label: 'Preview Sun',
            title: state.sceneHasSun
              ? 'Scene contains DirectionalLight3D. Preview disabled.'
              : "Godot's editor preview sun, for a scene with no light of its own",
            checked: state.showPreviewSun && !state.sceneHasSun,
            disabled: state.sceneHasSun,
            onChange: state.setShowPreviewSun,
          }),
          editorOnly('showPreviewEnvironment', {
            label: 'Preview Sky',
            title: state.sceneHasEnvironment
              ? 'Scene contains WorldEnvironment. Preview disabled.'
              : "Godot's editor preview sky, for a scene with no environment of its own",
            checked: state.showPreviewEnvironment && !state.sceneHasEnvironment,
            disabled: state.sceneHasEnvironment,
            onChange: state.setShowPreviewEnvironment,
          }),
        ]),
  ];
}

/** A handler that sets a viewport preference and persists it under `key`. */
function persisting<T>(set: (value: T) => void, key: string): (value: T) => void {
  return (value) => {
    set(value);
    writePersisted(key, value);
  };
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
    showGizmos,
    setShowGizmos,
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
    showFog,
    setShowFog,
    showPerformance,
    setShowPerformance,
  } = useViewportMode();
  const camera = useOptionalViewportActions();
  const isFreelookToggled = useIsFreelookToggled();
  const isFreelookAvailable = useIsFreelookAvailable() ?? false;
  const isPreviewing = camera != null && camera.previewedCameraPath !== null;
  const hierarchy = useOptionalHierarchy();
  const sceneLoaded = Boolean(hierarchy?.sceneGraph);

  // Godot disables a preview button, with the reason in its label, once the
  // scene supplies its own, so no preview doubles the scene's light (ADR-0025).
  const yielding = useLiveSceneNodes(YIELDS_A_PREVIEW);
  const sceneHasSun = yielding.some((entry) => entry.node.type === PREVIEW_SUN_YIELD_TYPE);
  const sceneHasEnvironment = yielding.some((entry) => entry.node.type === PREVIEW_ENVIRONMENT_YIELD_TYPE);

  function handleScreenshot() {
    const dataUrl = camera?.takeScreenshot();
    if (!dataUrl) return;
    downloadDataUrl(dataUrl, `tscn-preview-${Date.now()}.png`);
  }

  // Only the user's click persists: a programmatic writer, such as
  // WorkspaceAutoSelect, must not overwrite the stored preference.
  const handleModeClick = persisting(setMode, VIEWPORT_MODE_STORAGE_KEY);
  const handleGizmosChange = persisting(setShowGizmos, SHOW_GIZMOS_STORAGE_KEY);
  const handleGridChange = persisting(setShowGrid, SHOW_GRID_STORAGE_KEY);
  const handleFrameOnOpenChange = persisting(setFrameOnOpen, FRAME_ON_OPEN_STORAGE_KEY);
  const handleFogChange = persisting(setShowFog, SHOW_FOG_STORAGE_KEY);
  const handlePerformanceChange = persisting(setShowPerformance, SHOW_PERFORMANCE_STORAGE_KEY);

  const displayToggles = buildDisplayToggles({
    mode,
    showGizmos,
    setShowGizmos: handleGizmosChange,
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
    showFog,
    setShowFog: handleFogChange,
    showPerformance,
    setShowPerformance: handlePerformanceChange,
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
          title="End any camera preview and return the editor camera to the default view"
        >
          Reset Camera
        </button>
      )}
      {/* Present once a 3D canvas has registered its freelook, so it hides in 2D too. */}
      {mode === '3D' && camera && isFreelookToggled !== null && (
        <button
          type="button"
          className={isFreelookToggled ? `${styles.freelookButton} ${styles.active}` : styles.freelookButton}
          onClick={camera.toggleFreelook}
          disabled={isPreviewing || !isFreelookAvailable}
          aria-pressed={isFreelookToggled}
          data-testid="freelook-button"
          title={freelookTitle(isPreviewing, isFreelookAvailable)}
        >
          Freelook
        </button>
      )}
      {camera && (
        <button
          type="button"
          className={styles.resetButton}
          onClick={handleScreenshot}
          disabled={!sceneLoaded}
          data-testid="screenshot-button"
          title="Save the current view as a PNG"
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
            {MODE_LABELS[m]}
          </button>
        ))}
      </div>
      <DisplayMenu toggles={displayToggles} />
    </div>
  );
}
