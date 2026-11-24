import { useThree } from '@react-three/fiber';
import { useEffect } from 'react';
import * as THREE from 'three';
import { useSelectedNodePathStore } from './contexts/SelectionContext.js';
import { EditorControlsHandle, isDrawingPreview } from './EditorControlsHandle.js';
import { useEditorCameras } from './editorCamera/EditorCamerasContext.js';
import { isViewKeyEvent } from './viewFocus.js';
import { isFocusOriginKey, isFocusSelectionKey } from './editorKeyBindings.js';
import { absolutePathOf } from '../scene/nodePathWalk.js';

/** Godot's F and O (node_3d_editor_plugin.cpp:2655-2659). F frames bounds, not a point (ADR-0029). */
export function FocusShortcuts() {
  const selectedPath = useSelectedNodePathStore();
  const camera = useEditorCameras()?.slot('Camera3D').node ?? null;
  const get = useThree((s) => s.get);
  const element = useThree((s) => s.gl.domElement);

  useEffect(() => {
    function focusSelection(): void {
      const path = selectedPath.get();
      void camera?.call('focus', ...(path ? [absolutePathOf(path)] : []));
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
      if (isFocusSelectionKey(event)) focusSelection();
      // No O in a preview (node_3d_editor_plugin.cpp:1826-1829): it would move the authored Camera3D.
      else if (isFocusOriginKey(event) && !isDrawingPreview(get())) focusOrigin();
    }

    element.addEventListener('keydown', onKeyDown);
    return () => element.removeEventListener('keydown', onKeyDown);
  }, [element, get, selectedPath, camera]);

  return null;
}
