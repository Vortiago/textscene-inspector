/**
 * The "Cameras" detail tab lists the camera nodes of the **live scene tree**,
 * so a camera inside a sub-scene appears. A Camera3D row previews that camera
 * in the 3D viewport. A Camera2D row of the root viewport frames the 2D stage
 * on the camera's view and opens the 2D workspace.
 */
import { useOptionalViewportActions } from '../../contexts/ViewportActionsContext.js';
import { useViewportMode } from '../../contexts/ViewportModeContext.js';
import { useLiveSceneNodes, useSharedLiveTree } from '../../useLiveSceneTree.js';
import { node2dWorldPosition } from '../../node2dWorldTransform.js';
import { liveNodePatches } from '../../liveNodePatches.js';
import { liveScenePassResults } from '../../liveScenePass.js';
import { liveTreeOf } from '../../liveSceneTree.js';
import { camera2DView } from '../../../nodes/2d/camera2d/cameraView.js';
import type { Camera2DProperties } from '../../../nodes/2d/camera2d/types.js';
import type { TscnNode } from '../../../parser/types.js';
import { useProjectSettings } from '../../contexts/ProjectSettingsContext.js';
import { isCamera2DType, isCamera3DType } from '../../cameraNodeTypes.js';
import { isViewportBoundary } from '../../../nodes/viewport/subviewport/viewportBoundary.js';
import type { LiveTreeEntry } from '../../liveSceneTree.js';
import styles from './TscnPreviewShell.module.css';

/** Module level, so it stays stable and the memo of `useLiveSceneNodes` holds. */
const isCameraOrViewport = (n: TscnNode): boolean =>
  isCamera3DType(n.type) || isCamera2DType(n.type) || isViewportBoundary(n.type);

/** Whether `entry` sits under any of the viewports at `viewportPaths`. */
function isInsideViewport(entry: LiveTreeEntry, viewportPaths: readonly string[]): boolean {
  return viewportPaths.some((viewport) => entry.path.startsWith(`${viewport}/`));
}

export function CamerasPanel() {
  const cam = useOptionalViewportActions();
  const { setMode } = useViewportMode();
  const liveTree = useSharedLiveTree();
  const { viewportSize } = useProjectSettings();

  // One walk for both kinds. A Camera2D inside a SubViewport is that viewport's camera
  // (`camera_2d.cpp:342`), not the stage's.
  const entries = useLiveSceneNodes(isCameraOrViewport);
  const viewportPaths = entries.filter((e) => isViewportBoundary(e.node.type)).map((e) => e.path);
  const cameras3d = entries.filter((e) => isCamera3DType(e.node.type));
  const cameras2d = entries.filter((e) => isCamera2DType(e.node.type) && !isInsideViewport(e, viewportPaths));

  if (cameras3d.length === 0 && cameras2d.length === 0) {
    return <div className={styles.emptyState}>No camera nodes in this scene.</div>;
  }

  function lookThrough2D(path: string, properties: Camera2DProperties) {
    // Over the live tree, a Camera2D inside a sub-scene composes against the
    // instance transform instead of framing at the origin, and a RemoteTransform2D moves it.
    if (!liveTree) return;
    const placed = liveScenePassResults(liveNodePatches, liveTreeOf(liveTree.roots, liveTree.ctx));
    const worldPosition = node2dWorldPosition(liveTree.roots, liveTree.ctx, path, placed) ?? { x: 0, y: 0 };
    // The frame `<Canvas2DStage>` draws, so the camera lands where the stage shows it.
    cam?.requestFrame2D(
      camera2DView(properties, worldPosition, { x: viewportSize.width, y: viewportSize.height })
    );
    setMode('2D');
  }

  const activePath = cam?.previewedCameraPath ?? null;
  // A path that names no listed camera previews nothing, so the editor camera draws.
  const isEditorActive = !cameras3d.some((c) => c.path === activePath);
  return (
    <div className={styles.camList}>
      <button
        type="button"
        className={styles.camRow}
        data-active={isEditorActive}
        onClick={() => cam?.endCameraPreview()}
      >
        <span className={styles.camName}>Editor camera</span>
        <span className={styles.camTag}>{isEditorActive ? 'active' : 'use'}</span>
      </button>
      {cameras3d.map((c) => {
        const active = activePath === c.path;
        return (
          <button
            key={c.path}
            type="button"
            className={styles.camRow}
            data-active={active}
            onClick={() => cam?.previewCamera(c.path)}
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
