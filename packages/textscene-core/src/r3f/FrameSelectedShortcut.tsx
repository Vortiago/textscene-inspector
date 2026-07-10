/**
 * "F" frames the camera on the selected node (#224) — Blender/Godot-style:
 * frames the selection if one exists, else the whole scene. Reuses the
 * already-tested `frameSceneBounds` (TscnCanvas.tsx) and `resolveFrameTarget`
 * for the target resolution; this component is just the keydown wiring.
 *
 * Mount INSIDE `<Canvas>` (needs `useThree` for scene/camera/controls) —
 * unlike `<EscapeDeselect>`, which is viewport-mode-agnostic and lives
 * outside the canvas.
 */
import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import { useOptionalSelection } from './contexts/SelectionContext.js';
import { isTypingTarget } from './hooks/isTypingTarget.js';
import { resolveFrameTarget } from './resolveFrameTarget.js';
import { frameSceneBounds, type OrbitLike } from './TscnCanvas.js';

export function FrameSelectedShortcut() {
  const selection = useOptionalSelection();
  const selectedNodePath = selection?.selectedNodePath ?? null;
  const nodeObjectMap = selection?.nodeObjectMap ?? null;
  const get = useThree((s) => s.get);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key.toLowerCase() !== 'f') return;
      if (isTypingTarget(e.target)) return;
      const state = get();
      const target = resolveFrameTarget(state.scene, selectedNodePath, nodeObjectMap);
      frameSceneBounds(target, state.camera, state.controls as OrbitLike | null);
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [get, selectedNodePath, nodeObjectMap]);

  return null;
}
