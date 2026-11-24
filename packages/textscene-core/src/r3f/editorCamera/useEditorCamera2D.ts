import { useEffect } from 'react';
import { editorCamera2D, type Camera2DStage } from './editorCamera2D.js';
import { useEditorCameras } from './EditorCamerasContext.js';

/** `stage` stays one object while it mounts, so the node binds once. */
export function useEditorCamera2D(stage: Camera2DStage): void {
  const slot = useEditorCameras()?.slot('Camera2D');
  useEffect(() => slot?.bind(editorCamera2D(stage)), [slot, stage]);
}
