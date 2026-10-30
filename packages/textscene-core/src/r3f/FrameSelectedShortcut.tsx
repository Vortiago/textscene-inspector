/**
 * "F" frames the camera on the selected node, or the whole scene without a selection,
 * through `frameSceneBounds` and `resolveFrameTarget`. Mount inside `<Canvas>`, since it
 * needs `useThree`, unlike the mode-agnostic `<EscapeDeselect>` outside it.
 */
import { useThree } from '@react-three/fiber';
import { useOptionalSelection } from './contexts/SelectionContext.js';
import { isDrawingPreview } from './EditorControlsHandle.js';
import { useGlobalShortcut } from './hooks/useGlobalShortcut.js';
import { resolveFrameTarget } from './resolveFrameTarget.js';
import { frameSceneBounds, type OrbitLike } from './frameSceneBounds.js';

export function FrameSelectedShortcut() {
  const selection = useOptionalSelection();
  const selectedNodePath = selection?.selectedNodePath ?? null;
  const nodeObjectMap = selection?.nodeObjectMap ?? null;
  const get = useThree((s) => s.get);

  useGlobalShortcut('f', () => {
    const state = get();
    // No framing during a preview, as in CameraFit: `state.camera` is then the authored
    // Camera3D, and framing would overwrite its position, near and far.
    if (isDrawingPreview(state)) return;
    const target = resolveFrameTarget(state.scene, selectedNodePath, nodeObjectMap);
    frameSceneBounds(target, state.camera, state.controls as OrbitLike | null);
  });

  return null;
}
