import { useEffect, useState } from 'react';
import { useViewportMode } from '../ViewportMode/ViewportModeContext.js';
import { absolutePathOf } from '../../../scene/nodePathWalk.js';
import { GameCameraRows } from './GameCameraRows.js';
import { useCameraRows, type CameraRow } from './cameraRows.js';
import { usePreviewCamera } from './previewCamera.js';
import { usePreviewView } from './previewView.js';
import { warnOfCameraFailure } from '../../editorView/editorCamera/editorCameras.js';
import styles from './TscnPreviewShell.module.css';

/** The scene's cameras: an editor preview in the 3D and 2D views, the current cameras In-game. */
export function CamerasPanel() {
  const { mode } = useViewportMode();
  const cameras = useCameraRows();

  if (mode === 'in-game') {
    if (cameras.length === 0) return <div className={styles.emptyState}>No camera nodes in this scene.</div>;
    return <GameCameraRows cameras={cameras} />;
  }
  // A Camera2D inside a SubViewport is that viewport's camera (`camera_2d.cpp:342`), not the stage's.
  const cameras2d = cameras.filter((camera) => camera.dimension === '2D' && camera.viewport === null);
  return (
    <EditorCameraRows
      cameras3d={cameras.filter((camera) => camera.dimension === '3D')}
      cameras2d={cameras2d}
    />
  );
}

interface EditorCameraRowsProps {
  cameras3d: readonly CameraRow[];
  cameras2d: readonly CameraRow[];
}

/** A Camera3D row previews as Godot does, and leaves the game's current camera alone. */
function EditorCameraRows({ cameras3d, cameras2d }: EditorCameraRowsProps) {
  const preview = usePreviewCamera();
  const frame2D = useFrame2D();
  const { mode, setMode } = useViewportMode();

  function preview3D(path: string) {
    preview?.previewCamera(path);
    setMode('3D');
  }

  function lookThrough2D(path: string) {
    frame2D(path);
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
            <span className={styles.camName}>{c.name}</span>
            <span className={styles.camTag}>{active ? 'active' : 'use'}</span>
          </button>
        );
      })}
      {cameras2d.map((c) => (
        <button key={c.path} type="button" className={styles.camRow} onClick={() => lookThrough2D(c.path)}>
          <span className={styles.camName}>{c.name}</span>
          <span className={styles.camTag}>2D · frame view</span>
        </button>
      ))}
    </div>
  );
}

/** Waits for the 2D mode, since one click switches the mode and asks for the frame in one render. */
function useFrame2D(): (cameraPath: string) => void {
  const view = usePreviewView();
  const { mode } = useViewportMode();
  const [pending, setPending] = useState<string | null>(null);
  useEffect(() => {
    const camera = view?.editorCamera;
    if (!pending || mode !== '2D' || camera?.type !== 'Camera2D') return;
    setPending(null);
    camera.call('frame_camera_view', absolutePathOf(pending)).catch(warnOfCameraFailure);
  }, [pending, mode, view]);
  return setPending;
}
