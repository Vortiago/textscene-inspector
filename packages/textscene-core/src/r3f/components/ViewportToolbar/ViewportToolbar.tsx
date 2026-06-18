/**
 * Viewport controls mounted in the shell's top bar (P4/P5): a "Reset Camera"
 * button (3D only), the 3D/2D segmented switch, and a collision-wireframe
 * toggle. Writes through `useViewportMode()` so the center viewport swaps
 * between the R3F canvas and the 2D Control overlay, and CollisionShape3D
 * gizmos show/hide. Shared by both apps via TscnPreviewShell, so feature parity
 * is automatic — including Reset Camera, which the web app previously owned.
 */

import { useViewportMode, type ViewportMode } from '../../contexts/ViewportModeContext.js';
import { useOptionalCameraControl } from '../../contexts/CameraControlContext.js';
import { useOptionalHierarchy } from '../../contexts/HierarchyContext.js';
import styles from './ViewportToolbar.module.css';

const MODES: ViewportMode[] = ['3D', '2D'];

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
  } = useViewportMode();
  const camera = useOptionalCameraControl();
  const hierarchy = useOptionalHierarchy();
  const sceneLoaded = Boolean(hierarchy?.sceneGraph);

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
      <div className={styles.segment} role="group" aria-label="Viewport dimension">
        {MODES.map((m) => (
          <button
            key={m}
            type="button"
            className={m === mode ? `${styles.segmentButton} ${styles.active}` : styles.segmentButton}
            aria-pressed={m === mode}
            onClick={() => setMode(m)}
          >
            {m}
          </button>
        ))}
      </div>
      <label className={styles.checkbox} title="Show CollisionShape3D wireframes">
        <input
          type="checkbox"
          checked={showCollisions}
          onChange={(e) => setShowCollisions(e.target.checked)}
        />
        Collisions
      </label>
      <label className={styles.checkbox} title="Show Label3D text in the viewport">
        <input
          type="checkbox"
          checked={showLabels}
          onChange={(e) => setShowLabels(e.target.checked)}
        />
        Labels
      </label>
      <label className={styles.checkbox} title="Show NavigationRegion overlays">
        <input
          type="checkbox"
          checked={showNavigation}
          onChange={(e) => setShowNavigation(e.target.checked)}
        />
        Navigation
      </label>
    </div>
  );
}
