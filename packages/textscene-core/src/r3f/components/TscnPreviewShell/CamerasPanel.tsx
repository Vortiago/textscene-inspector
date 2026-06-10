/**
 * The "Cameras" detail tab: lists the scene's Camera3D nodes and lets the user
 * make one the active viewport camera (or return to free orbit), via
 * `CameraControlContext`. Mirrors the per-node "Use This Camera" action in the
 * Inspector, surfaced as a flat list so cameras are discoverable without
 * hunting the tree.
 */
import { useMemo } from 'react';
import { useHierarchy } from '../../contexts/HierarchyContext.js';
import { useOptionalCameraControl } from '../../contexts/CameraControlContext.js';
import styles from './TscnPreviewShell.module.css';

export function CamerasPanel() {
  const { sceneGraph } = useHierarchy();
  const cam = useOptionalCameraControl();
  const cameras = useMemo(
    () => (sceneGraph?.flattenedNodes ?? []).filter((n) => n.data.type === 'Camera3D'),
    [sceneGraph]
  );

  if (cameras.length === 0) {
    return <div className={styles.emptyState}>No Camera3D nodes in this scene.</div>;
  }

  const activePath = cam?.activeCameraPath ?? null;
  return (
    <div className={styles.camList}>
      <button
        type="button"
        className={styles.camRow}
        data-active={activePath === null}
        onClick={() => cam?.returnToFreeView()}
      >
        <span className={styles.camName}>Free orbit</span>
        <span className={styles.camTag}>{activePath === null ? 'active' : 'use'}</span>
      </button>
      {cameras.map((c) => {
        const active = activePath === c.path;
        return (
          <button
            key={c.path}
            type="button"
            className={styles.camRow}
            data-active={active}
            onClick={() => cam?.switchToCamera(c.path)}
          >
            <span className={styles.camName}>{c.name}</span>
            <span className={styles.camTag}>{active ? 'active' : 'use'}</span>
          </button>
        );
      })}
    </div>
  );
}
