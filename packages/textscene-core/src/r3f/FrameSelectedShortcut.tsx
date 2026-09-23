/**
 * "F" frames the camera on the selected node, or the whole scene without a selection,
 * through `frameSceneBounds` and `resolveFrameTarget`. Mount inside `<Canvas>`, since it
 * needs `useThree`, unlike the mode-agnostic `<EscapeDeselect>` outside it.
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
    // Free-orbit only, as in CameraFit: under "Use This Camera", `state.camera` is the
    // authored Camera3D, and framing would overwrite its position, near and far.
    if (control?.activeCameraPath) return;
    const state = get();
    const target = resolveFrameTarget(state.scene, selectedNodePath, nodeObjectMap);
    frameSceneBounds(target, state.camera, state.controls as OrbitLike | null);
  });

  return null;
}
