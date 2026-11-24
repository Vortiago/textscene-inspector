import { useEffect, useState } from 'react';
import { useViewportMode } from '../ViewportMode/ViewportModeContext.js';
import { useLiveSceneNodes, useSharedLiveTree } from '../../useLiveSceneTree.js';
import { livePlacements, node2dWorldPosition } from '../../node2dWorldTransform.js';
import { useResourceLoader } from '../../../resources/useResource.js';
import { camera2DView } from '../../viewportRender/camera2DView.js';
import type { Camera2DProperties } from '../../../nodes/2d/camera2d/types.js';
import type { TscnNode } from '../../../parser/types.js';
import { useProjectSettings } from '../../contexts/ProjectSettingsContext.js';
import { isCamera2DType, isCamera3DType } from '../../cameraNodeTypes.js';
import { isViewportBoundary } from '../../viewportRender/viewportBoundary.js';
import type { LiveTreeEntry } from '../../liveSceneTree.js';
import { GameCameraRows } from './GameCameraRows.js';
import { usePreviewCamera } from './previewCamera.js';
import { usePreviewView } from './previewView.js';
import { warnOfCameraFailure } from '../../editorView/editorCamera/editorCameras.js';
import { variantOf } from '../../../scene/variant.js';
import { VARIANT_TYPE as T } from '../../../godot/variant/variantType.js';
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
  const cameras = entries.filter((e) => isCamera3DType(e.node.type) || isCamera2DType(e.node.type));

  if (mode === 'in-game') {
    if (cameras.length === 0) return <div className={styles.emptyState}>No camera nodes in this scene.</div>;
    return <GameCameraRows cameras={cameras} />;
  }
  const viewportPaths = entries.filter((e) => isViewportBoundary(e.node.type)).map((e) => e.path);
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

/** A Camera3D row previews as Godot does, and leaves the game's current camera alone. */
function EditorCameraRows({ cameras3d, cameras2d }: EditorCameraRowsProps) {
  const preview = usePreviewCamera();
  const frame2D = useFrame2D();
  const { mode, setMode } = useViewportMode();
  const liveTree = useSharedLiveTree();
  const loader = useResourceLoader();
  const { viewportSize } = useProjectSettings();

  function preview3D(path: string) {
    preview?.previewCamera(path);
    setMode('3D');
  }

  function lookThrough2D(path: string, properties: Camera2DProperties) {
    // Over the live tree, a Camera2D inside a sub-scene composes against the
    // instance transform instead of framing at the origin, and a RemoteTransform2D or a solved bone above it moves it.
    if (!liveTree) return;
    const placed = livePlacements(liveTree, loader);
    const worldPosition = node2dWorldPosition(liveTree.roots, liveTree.ctx, path, placed) ?? { x: 0, y: 0 };
    // The frame `<Canvas2DStage>` draws, so the camera lands where the stage shows it.
    frame2D(camera2DView(properties, worldPosition, { x: viewportSize.width, y: viewportSize.height }));
    setMode('2D');
  }

  // Each editor mode has its own editor camera, so the row keeps the mode.
  function showEditorCamera() {
    preview?.endPreview();
  }

  // Only the 3D view draws through a previewed camera, so the 2D view marks none.
  const activePath = mode === '3D' ? (preview?.camera ?? null) : null;
  // A path that names no listed camera previews nothing, so the editor camera draws.
  const isEditorActive = !cameras3d.some((c) => c.path === activePath);
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

interface Frame2D {
  center: { x: number; y: number };
  zoom: number;
}

/** Waits for the 2D mode, since one click switches the mode and asks for the frame in one render. */
function useFrame2D(): (frame: Frame2D) => void {
  const view = usePreviewView();
  const { mode } = useViewportMode();
  const [pending, setPending] = useState<Frame2D | null>(null);
  useEffect(() => {
    const camera = view?.editorCamera;
    if (!pending || mode !== '2D' || camera?.type !== 'Camera2D') return;
    setPending(null);
    // The zoom first, so the centre lands at the zoom it is framed at.
    const zoom = variantOf({ type: T.VECTOR2, value: [pending.zoom, pending.zoom] });
    const centre = variantOf({ type: T.VECTOR2, value: [pending.center.x, pending.center.y] });
    camera.set('zoom', zoom).catch(warnOfCameraFailure);
    camera.set('position', centre).catch(warnOfCameraFailure);
  }, [pending, mode, view]);
  return setPending;
}
