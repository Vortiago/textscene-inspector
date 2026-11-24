import { useThree } from '@react-three/fiber';
import { useEffect } from 'react';
import * as THREE from 'three';
import { useOptionalSelection, useSelectedNodePathStore } from './contexts/SelectionContext.js';
import { EditorControlsHandle, isDrawingPreview } from './EditorControlsHandle.js';
import { isViewKeyEvent } from './viewFocus.js';
import { isFocusOriginKey, isFocusSelectionKey } from './editorKeyBindings.js';
import { resolveFrameTarget } from './resolveFrameTarget.js';
import { frameSceneBounds, type OrbitLike } from './frameSceneBounds.js';

/** Godot's F and O (node_3d_editor_plugin.cpp:2655-2659). F frames bounds, not a point (ADR-0029). */
export function FocusShortcuts() {
  const selectedPath = useSelectedNodePathStore();
  const nodeObjectMap = useOptionalSelection()?.nodeObjectMap ?? null;
  const get = useThree((s) => s.get);
  const element = useThree((s) => s.gl.domElement);

  useEffect(() => {
    function focusSelection(): void {
      const state = get();
      const target = resolveFrameTarget(state.scene, selectedPath.get(), nodeObjectMap);
      frameSceneBounds(target, state.camera, state.controls as OrbitLike | null);
    }

    /** node_3d_editor_plugin.cpp:4034-4036. */
    function focusOrigin(): void {
      const { controls, invalidate } = get();
      if (!(controls instanceof EditorControlsHandle)) return;
      controls.applyCursor({ ...controls.cursor(), target: new THREE.Vector3() });
      invalidate();
    }

    function onKeyDown(event: KeyboardEvent): void {
      if (!isViewKeyEvent(event, element)) return;
      // No key in a preview (node_3d_editor_plugin.cpp:1826-1829): F would move the authored Camera3D.
      if (isDrawingPreview(get())) return;
      if (isFocusSelectionKey(event)) focusSelection();
      else if (isFocusOriginKey(event)) focusOrigin();
    }

    element.addEventListener('keydown', onKeyDown);
    return () => element.removeEventListener('keydown', onKeyDown);
  }, [element, get, selectedPath, nodeObjectMap]);

  return null;
}
