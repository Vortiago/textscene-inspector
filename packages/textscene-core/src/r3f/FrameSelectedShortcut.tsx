/**
 * "F" frames the camera on the selected node — Blender/Godot-style:
 * frames the selection if one exists, else the whole scene. Reuses the
 * already-tested `frameSceneBounds` and `resolveFrameTarget` for the target
 * resolution; this component is just the `useGlobalShortcut` wiring.
 *
 * Mount INSIDE `<Canvas>` (needs `useThree` for scene/camera/controls) —
 * unlike `<EscapeDeselect>`, which is viewport-mode-agnostic and lives
 * outside the canvas.
 */
import { useThree } from '@react-three/fiber';
import { useOptionalSelection } from './contexts/SelectionContext.js';
import { useOptionalCameraControl } from './contexts/CameraControlContext.js';
import { useGlobalShortcut } from './hooks/useGlobalShortcut.js';
import { resolveFrameTarget } from './resolveFrameTarget.js';
import { frameSceneBounds, type OrbitLike } from './frameSceneBounds.js';

export function FrameSelectedShortcut() {
  const selection = useOptionalSelection();
  const control = useOptionalCameraControl();
  const selectedNodePath = selection?.selectedNodePath ?? null;
  const nodeObjectMap = selection?.nodeObjectMap ?? null;
  const get = useThree((s) => s.get);

  useGlobalShortcut('f', () => {
    // Free-orbit only — same guard as CameraFit: while "Use This Camera" is
    // active, `state.camera` IS the authored Camera3D, and framing would
    // overwrite that node's position/near/far (corrupting the preview).
    if (control?.activeCameraPath) return;
    const state = get();
    const target = resolveFrameTarget(state.scene, selectedNodePath, nodeObjectMap);
    frameSceneBounds(target, state.camera, state.controls as OrbitLike | null);
  });

  return null;
}
