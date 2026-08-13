/**
 * The "Cameras" detail tab: lists the scene's camera nodes and lets the user
 * look through one. Camera3D rows swap the 3D viewport's camera
 * (`CameraControlContext.switchToCamera`); Camera2D rows frame the 2D stage
 * on the camera's view — world position composed statically over the scene
 * graph, anchored per the Camera2D surface — and open the 2D workspace.
 * Mirrors the per-node "Use This Camera" action in the Inspector, surfaced
 * as a flat list so cameras are discoverable without hunting the tree.
 *
 * Cameras are gathered from the **live scene tree** (`collectLiveNodes`), not
 * `SceneGraph.flattenedNodes` — so cameras INSIDE instanced sub-scenes (e.g. a
 * player's follow-camera) appear. The list recomputes as sub-scenes / GLBs
 * stream in (the live tree grows after the parsed SceneGraph is built).
 */
import { useHierarchy } from '../../contexts/HierarchyContext.js';
import { useOptionalCameraControl } from '../../contexts/CameraControlContext.js';
import { useViewportMode } from '../../contexts/ViewportModeContext.js';
import { useLiveSceneNodes, liveTreeContext } from '../../useLiveSceneTree.js';
import { useResourceLoader } from '../../../resources/useResource.js';
import { node2dWorldPosition } from '../../node2dWorldTransform.js';
import { camera2DView } from '../../../nodes/2d/camera2d/cameraView.js';
import type { Camera2DProperties } from '../../../nodes/2d/camera2d/types.js';
import type { TscnNode } from '../../../parser/types.js';
import { useProjectSettings } from '../../contexts/ProjectSettingsContext.js';
import { isCamera2DType, isCamera3DType } from '../../cameraNodeTypes.js';
import styles from './TscnPreviewShell.module.css';

/** Stable predicate so `useLiveSceneNodes`' memo doesn't recompute each render. */
const isCameraNode = (n: TscnNode): boolean => isCamera3DType(n.type) || isCamera2DType(n.type);

export function CamerasPanel() {
  const { sceneGraph } = useHierarchy();
  const cam = useOptionalCameraControl();
  const { setMode } = useViewportMode();
  const loader = useResourceLoader();
  const { viewportSize } = useProjectSettings();

  // From the LIVE scene tree, so cameras inside instanced sub-scenes appear.
  const cameras = useLiveSceneNodes(isCameraNode);
  const cameras3d = cameras.filter((c) => isCamera3DType(c.node.type));
  const cameras2d = cameras.filter((c) => isCamera2DType(c.node.type));

  if (cameras3d.length === 0 && cameras2d.length === 0) {
    return <div className={styles.emptyState}>No camera nodes in this scene.</div>;
  }

  function lookThrough2D(path: string, properties: Camera2DProperties) {
    // World position over the LIVE tree, so a Camera2D inside an instanced
    // sub-scene composes against the instance transform instead of framing at
    // the origin (the sub-scene node is absent from the static SceneGraph).
    const lt = liveTreeContext(sceneGraph, loader);
    if (!lt) return;
    const worldPosition = node2dWorldPosition(lt.roots, lt.ctx, path) ?? { x: 0, y: 0 };
    // The project's own viewport rect — the same frame `<Canvas2DStage>`
    // draws, so "look through" lands the camera where the stage shows it.
    cam?.requestFrame2D(
      camera2DView(properties, worldPosition, { x: viewportSize.width, y: viewportSize.height })
    );
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
            <span className={styles.camName}>{c.node.name}</span>
            <span className={styles.camTag}>{active ? 'active' : 'use'}</span>
          </button>
        );
      })}
      {cameras2d.map((c) => (
        <button
          key={c.path}
          type="button"
          className={styles.camRow}
          onClick={() => lookThrough2D(c.path, c.node.properties as Camera2DProperties)}
        >
          <span className={styles.camName}>{c.node.name}</span>
          <span className={styles.camTag}>2D · view</span>
        </button>
      ))}
    </div>
  );
}
