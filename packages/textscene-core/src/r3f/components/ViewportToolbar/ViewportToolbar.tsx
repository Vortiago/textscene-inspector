/**
 * Viewport-mode controls mounted in the shell's toolbar row (P4): a 3D/2D
 * segmented switch and a collision-wireframe toggle. Writes through
 * `useViewportMode()` so the center viewport swaps between the R3F canvas and
 * the 2D Control overlay, and CollisionShape3D gizmos show/hide. Shared by both
 * apps via TscnPreviewShell, so feature parity is automatic.
 */

import { useViewportMode, type ViewportMode } from '../../contexts/ViewportModeContext.js';
import styles from './ViewportToolbar.module.css';

const MODES: ViewportMode[] = ['3D', '2D'];

export function ViewportToolbar() {
  const { mode, setMode, showCollisions, setShowCollisions } = useViewportMode();

  return (
    <div className={styles.toolbar} role="toolbar" aria-label="Viewport mode">
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
    </div>
  );
}
