/**
 * Viewport controls, floated over the viewport: "Reset Camera" and
 * "Screenshot" (3D only), the 3D/2D segmented switch, and every display
 * overlay behind a single `<DisplayMenu>`. Writes through `useViewportMode()`
 * so the center viewport swaps between the R3F canvas and the 2D Control
 * overlay, and the gizmos show/hide. Shared by both apps via TscnPreviewShell,
 * so feature parity is automatic — including Reset Camera, which the web app
 * previously owned.
 *
 * The bar holds only what is reached for constantly. The toggles moved into
 * the menu once there were seven of them: the bar wrapped to a second row,
 * covered the top of the scene it controls, and hid the controls legend
 * beneath itself.
 *
 * Screenshot downloads the current 3D frame as a PNG via
 * `CameraControlContext`'s registered handler (`<TscnCanvas>`'s
 * `ScreenshotBridge`).
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

/** Triggers a browser download of a data URL via a throwaway anchor element. */
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

  // Godot disables each preview button outright — with the reason in its label
  // — once the scene supplies its own, rather than letting the user re-enable a
  // preview that would double up on the scene's lighting (ADR-0025).
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

  // #224: persistence happens HERE, at the explicit user choice, never via a
  // blanket context→storage sync — programmatic writers (WorkspaceAutoSelect's
  // typed-root pick, the Cameras panel's 2D framing) must not overwrite the
  // user's stored preference. See VIEWPORT_MODE_STORAGE_KEY's doc.
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

  // 3D-only entries drop out in 2D rather than sitting there inert — the grid,
  // the framing preference and both preview-lighting stand-ins have no meaning
  // over the Control overlay.
  const displayToggles: DisplayToggle[] = [
    {
      label: 'Collisions',
      title: 'Show CollisionShape3D wireframes',
      checked: showCollisions,
      onChange: setShowCollisions,
    },
    {
      label: 'Labels',
      title: 'Show Label3D text in the viewport',
      checked: showLabels,
      onChange: setShowLabels,
    },
    {
      label: 'Navigation',
      title: 'Show NavigationRegion overlays',
      checked: showNavigation,
      onChange: setShowNavigation,
    },
  ];
  if (mode === '3D') {
    displayToggles.push(
      {
        label: 'Frame on open',
        title:
          'Frame the whole scene when it loads. Off matches Godot, which opens at a fixed orbit — press F to frame.',
        checked: frameOnOpen,
        onChange: handleFrameOnOpenChange,
      },
      {
        label: 'Grid',
        title: 'Show a ground-plane reference grid',
        checked: showGrid,
        onChange: handleGridChange,
      },
      {
        label: 'Preview Sun',
        title: sceneHasSun
          ? 'Scene contains DirectionalLight3D. Preview disabled.'
          : "Godot's editor preview sun, for a scene with no light of its own",
        checked: showPreviewSun && !sceneHasSun,
        disabled: sceneHasSun,
        onChange: setShowPreviewSun,
      },
      {
        label: 'Preview Sky',
        title: sceneHasEnvironment
          ? 'Scene contains WorldEnvironment. Preview disabled.'
          : "Godot's editor preview sky, for a scene with no environment of its own",
        checked: showPreviewEnvironment && !sceneHasEnvironment,
        disabled: sceneHasEnvironment,
        onChange: setShowPreviewEnvironment,
      }
    );
  }

  return (
    <div className={styles.toolbar} role="toolbar" aria-label="Viewport controls">
      {/* Reset Camera is a 3D-orbit affordance; hide it in 2D overlay mode. */}
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
