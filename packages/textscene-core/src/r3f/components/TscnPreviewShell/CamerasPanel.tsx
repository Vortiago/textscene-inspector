import { useOptionalViewportActions } from '../../contexts/ViewportActionsContext.js';
import { useViewportMode } from '../../contexts/ViewportModeContext.js';
import { useLiveSceneNodes, useSharedLiveTree } from '../../useLiveSceneTree.js';
import { node2dWorldPosition } from '../../node2dWorldTransform.js';
import { solvedNodePatchesOf } from '../../liveNodePatches.js';
import { liveTreeOf } from '../../liveSceneTree.js';
import { liveFilesOf } from '../../liveFiles.js';
import { useResourceLoader } from '../../../resources/useResource.js';
import { camera2DView } from '../../viewportRender/camera2DView.js';
import type { Camera2DProperties } from '../../../nodes/2d/camera2d/types.js';
import type { TscnNode } from '../../../parser/types.js';
import { useProjectSettings } from '../../contexts/ProjectSettingsContext.js';
import { isCamera2DType, isCamera3DType } from '../../cameraNodeTypes.js';
import { isViewportBoundary } from '../../viewportRender/viewportBoundary.js';
import type { LiveTreeEntry } from '../../liveSceneTree.js';
import { GameCameraRows } from './GameCameraRows.js';
import styles from './TscnPreviewShell.module.css';

/** Module level, so it stays stable and the memo of `useLiveSceneNodes` holds. */
const isCameraOrViewport = (n: TscnNode): boolean =>
  isCamera3DType(n.type) || isCamera2DType(n.type) || isViewportBoundary(n.type);

/** Whether `entry` sits under any of the viewports at `viewportPaths`. */
function isInsideViewport(entry: LiveTreeEntry, viewportPaths: readonly string[]): boolean {
  return viewportPaths.some((viewport) => entry.path.startsWith(`${viewport}/`));
}

/** The live tree's cameras: an editor preview in the 3D and 2D views, the current cameras In-game. */
export function CamerasPanel() {
  const { mode } = useViewportMode();
  // One walk for both kinds and the viewports that hold them.
  const entries = useLiveSceneNodes(isCameraOrViewport);
  const viewportPaths = entries.filter((e) => isViewportBoundary(e.node.type)).map((e) => e.path);
  const cameras = entries.filter((e) => isCamera3DType(e.node.type) || isCamera2DType(e.node.type));

  if (cameras.length === 0) {
    return <div className={styles.emptyState}>No camera nodes in this scene.</div>;
  }
  if (mode === 'in-game') return <GameCameraRows cameras={cameras} viewportPaths={viewportPaths} />;
  // A Camera2D inside a SubViewport is that viewport's camera (`camera_2d.cpp:342`), not the stage's.
  const cameras2d = cameras.filter((e) => isCamera2DType(e.node.type) && !isInsideViewport(e, viewportPaths));
  return (
    <EditorCameraRows cameras3d={cameras.filter((e) => isCamera3DType(e.node.type))} cameras2d={cameras2d} />
  );
}

interface EditorCameraRowsProps {
  cameras3d: readonly LiveTreeEntry[];
  cameras2d: readonly LiveTreeEntry[];
}

/** The editor's own cameras: Godot's 3D camera preview, which leaves the game's current camera alone. */
function EditorCameraRows({ cameras3d, cameras2d }: EditorCameraRowsProps) {
  const cam = useOptionalViewportActions();
  const { mode, setMode } = useViewportMode();
  const liveTree = useSharedLiveTree();
  const loader = useResourceLoader();
  const { viewportSize } = useProjectSettings();

  function preview3D(path: string) {
    cam?.previewCamera(path);
    setMode('3D');
  }

  function lookThrough2D(path: string, properties: Camera2DProperties) {
    // Over the live tree, a Camera2D inside a sub-scene composes against the
    // instance transform instead of framing at the origin, and a RemoteTransform2D or a solved bone above it moves it.
    if (!liveTree) return;
    const placed = solvedNodePatchesOf(
      liveTreeOf(liveTree.roots, liveTree.ctx),
      liveFilesOf(loader).current()
    );
    const worldPosition = node2dWorldPosition(liveTree.roots, liveTree.ctx, path, placed) ?? { x: 0, y: 0 };
    // The frame `<Canvas2DStage>` draws, so the camera lands where the stage shows it.
    cam?.requestFrame2D(
      camera2DView(properties, worldPosition, { x: viewportSize.width, y: viewportSize.height })
    );
    setMode('2D');
  }

  function showEditorCamera() {
    cam?.endCameraPreview();
    setMode('3D');
  }

  // Only the 3D view draws through a previewed camera, so the 2D view marks none.
  const activePath = mode === '3D' ? (cam?.previewedCameraPath ?? null) : null;
  // A path that names no listed camera previews nothing, so the editor camera draws.
  const isEditorActive = mode === '3D' && !cameras3d.some((c) => c.path === activePath);
  return (
    <div className={styles.camList}>
      <button type="button" className={styles.camRow} data-active={isEditorActive} onClick={showEditorCamera}>
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
            onClick={() => preview3D(c.path)}
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
          <span className={styles.camTag}>2D · frame view</span>
        </button>
      ))}
    </div>
  );
}
