import {
  useViewportMode,
  FRAME_ON_OPEN_STORAGE_KEY,
  SHOW_STORAGE_KEYS,
  isPersistedShowKey,
  VIEWPORT_MODE_STORAGE_KEY,
  type ViewportMode,
} from '../../contexts/ViewportModeContext.js';
import { RUNNING_GAME_SHOW, type ViewShow } from '../../viewShow/viewShow.js';
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
import type { ViewAnswers } from '../../viewStatus/viewAnswers.js';
import { captureWhenSettled } from '../TscnPreviewShell/viewSettle.js';
import { usePreviewCamera } from '../TscnPreviewShell/previewCamera.js';
import * as logger from '../../../logger.js';
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

/** Everything `buildDisplayToggles` needs. */
interface DisplayToggleState {
  mode: ViewportMode;
  show: ViewShow;
  setShowKey: (key: keyof ViewShow, on: boolean) => void;
  frameOnOpen: boolean;
  setFrameOnOpen: (frame: boolean) => void;
  sceneHasSun: boolean;
  sceneHasEnvironment: boolean;
}

const NO_EFFECT_IN_GAME_TITLE = 'No effect in the In-game view, which draws as the game does';

/** The overlays the Display menu offers, and their state, in the menu's order. */
function buildDisplayToggles(state: DisplayToggleState): readonly DisplayToggle[] {
  const { show } = state;
  // A toggle the running game overrides is disabled In-game. It keeps the user's value.
  const editorOnly = (toggle: DisplayToggle): DisplayToggle =>
    state.mode === 'in-game' ? { ...toggle, title: NO_EFFECT_IN_GAME_TITLE, disabled: true } : toggle;
  const ofShow = (key: keyof ViewShow, label: string, title: string): DisplayToggle => {
    const toggle = {
      label,
      title,
      checked: show[key],
      onChange: (on: boolean) => state.setShowKey(key, on),
    };
    return key in RUNNING_GAME_SHOW ? editorOnly(toggle) : toggle;
  };
  // A preview the scene supplies its own of is disabled and unchecked, as Godot's button (ADR-0025).
  const ofPreview = (
    key: 'previewSun' | 'previewEnvironment',
    label: string,
    isYielded: boolean,
    titles: { yielded: string; shown: string }
  ): DisplayToggle => {
    const toggle = ofShow(key, label, isYielded ? titles.yielded : titles.shown);
    return isYielded ? { ...toggle, checked: false, disabled: true } : toggle;
  };
  return [
    ofShow(
      'gizmos',
      'Gizmos',
      "Show the editor gizmos, faint on a node that is not selected, as Godot's View Gizmos does"
    ),
    ofShow('collisions', 'Collisions', 'Show CollisionShape3D wireframes'),
    ofShow('labels', 'Labels', 'Show Label3D text in the viewport'),
    ofShow('navigation', 'Navigation', 'Show NavigationRegion overlays'),
    ofShow('performance', 'Performance', 'Show the frame rate and the time each render step takes'),
    // The grid, the framing, the fog and the preview lighting mean nothing over the 2D Control overlay.
    ...(state.mode === '2D'
      ? []
      : [
          editorOnly({
            label: 'Frame on open',
            title:
              'Frame the whole scene when it loads. Off matches Godot, which opens at a fixed orbit — press F to frame.',
            checked: state.frameOnOpen,
            onChange: state.setFrameOnOpen,
          }),
          ofShow('grid', 'Grid', 'Show a ground-plane reference grid'),
          ofShow('fog', 'Fog', "Draw the Environment's depth and volumetric fog. Off skips the fog passes."),
          ofPreview('previewSun', 'Preview Sun', state.sceneHasSun, {
            yielded: 'Scene contains DirectionalLight3D. Preview disabled.',
            shown: "Godot's editor preview sun, for a scene with no light of its own",
          }),
          ofPreview('previewEnvironment', 'Preview Sky', state.sceneHasEnvironment, {
            yielded: 'Scene contains WorldEnvironment. Preview disabled.',
            shown: "Godot's editor preview sky, for a scene with no environment of its own",
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

/** Downloads a file through a throwaway anchor element. */
function download(file: Blob, filename: string): void {
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export interface ViewportToolbarProps {
  /** The mounted view, or null while none is: Screenshot saves its image. */
  view: ViewAnswers | null;
}

export function ViewportToolbar({ view }: ViewportToolbarProps) {
  const { mode, setMode, show, setShow, frameOnOpen, setFrameOnOpen } = useViewportMode();
  const camera = useOptionalViewportActions();
  const isFreelookToggled = useIsFreelookToggled();
  const isFreelookAvailable = useIsFreelookAvailable() ?? false;
  const preview = usePreviewCamera();
  const isPreviewing = (preview?.camera ?? null) !== null;
  const hierarchy = useOptionalHierarchy();
  const sceneLoaded = Boolean(hierarchy?.sceneGraph);

  // Godot disables a preview button, with the reason in its label, once the
  // scene supplies its own, so no preview doubles the scene's light (ADR-0025).
  const yielding = useLiveSceneNodes(YIELDS_A_PREVIEW);
  const sceneHasSun = yielding.some((entry) => entry.node.type === PREVIEW_SUN_YIELD_TYPE);
  const sceneHasEnvironment = yielding.some((entry) => entry.node.type === PREVIEW_ENVIRONMENT_YIELD_TYPE);

  function handleScreenshot() {
    if (!view) return;
    captureWhenSettled(view).then(
      (image) => download(image, `tscn-preview-${Date.now()}.png`),
      // The view left or never settles: the top bar shows why, so the click saves nothing.
      (error: unknown) => logger.warn('[ViewportToolbar] screenshot not taken', error)
    );
  }

  // Only the user's click persists: a programmatic writer, such as
  // WorkspaceAutoSelect, must not overwrite the stored preference.
  const handleModeClick = persisting(setMode, VIEWPORT_MODE_STORAGE_KEY);
  const handleFrameOnOpenChange = persisting(setFrameOnOpen, FRAME_ON_OPEN_STORAGE_KEY);
  const handleShowChange = (key: keyof ViewShow, on: boolean) => {
    setShow({ [key]: on });
    if (isPersistedShowKey(key)) writePersisted(SHOW_STORAGE_KEYS[key], on);
  };

  const displayToggles = buildDisplayToggles({
    mode,
    show,
    setShowKey: handleShowChange,
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
          onClick={() => {
            preview?.endPreview();
            camera.resetCamera();
          }}
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
      {view && (
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
