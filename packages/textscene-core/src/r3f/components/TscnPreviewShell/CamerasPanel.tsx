/**
 * The "Cameras" detail tab: lists the scene's camera nodes and lets the user
 * look through one. Camera3D rows swap the 3D viewport's camera
 * (`CameraControlContext.switchToCamera`); Camera2D rows frame the 2D stage
 * on the camera's view — world position composed statically over the scene
 * graph, anchored per the Camera2D surface — and open the 2D workspace.
 * Mirrors the per-node "Use This Camera" action in the Inspector, surfaced
 * as a flat list so cameras are discoverable without hunting the tree.
 */
import { useMemo } from 'react';
import { useHierarchy } from '../../contexts/HierarchyContext.js';
import { useOptionalCameraControl } from '../../contexts/CameraControlContext.js';
import { useViewportMode } from '../../contexts/ViewportModeContext.js';
import { node2dWorldPosition } from '../../node2dWorldTransform.js';
import { camera2DView } from '../../../nodes/2d/camera2d/cameraView.js';
import type { Camera2DProperties } from '../../../nodes/2d/camera2d/types.js';
import { CANVAS_2D_WIDTH, CANVAS_2D_HEIGHT } from '../Canvas2DStage/viewport2d.js';
import styles from './TscnPreviewShell.module.css';

/** Godot's default 2D project viewport — shared with the Canvas2DStage frame. */
const VIEWPORT_2D = { x: CANVAS_2D_WIDTH, y: CANVAS_2D_HEIGHT };

export function CamerasPanel() {
  const { sceneGraph } = useHierarchy();
  const cam = useOptionalCameraControl();
  const { setMode } = useViewportMode();
  const cameras3d = useMemo(
    () => (sceneGraph?.flattenedNodes ?? []).filter((n) => n.data.type === 'Camera3D'),
    [sceneGraph]
  );
  const cameras2d = useMemo(
    () => (sceneGraph?.flattenedNodes ?? []).filter((n) => n.data.type === 'Camera2D'),
    [sceneGraph]
  );

  if (cameras3d.length === 0 && cameras2d.length === 0) {
    return <div className={styles.emptyState}>No camera nodes in this scene.</div>;
  }

  function lookThrough2D(path: string, properties: Camera2DProperties) {
    if (!sceneGraph) return;
    const worldPosition = node2dWorldPosition(sceneGraph, path) ?? { x: 0, y: 0 };
    cam?.requestFrame2D(camera2DView(properties, worldPosition, VIEWPORT_2D));
    setMode('2D');
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
      {cameras3d.map((c) => {
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
      {cameras2d.map((c) => (
        <button
          key={c.path}
          type="button"
          className={styles.camRow}
          onClick={() => lookThrough2D(c.path, c.data.properties as Camera2DProperties)}
        >
          <span className={styles.camName}>{c.name}</span>
          <span className={styles.camTag}>2D · view</span>
        </button>
      ))}
    </div>
  );
}
