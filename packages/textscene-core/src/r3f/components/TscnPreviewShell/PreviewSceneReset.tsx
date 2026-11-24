import { useCallback } from 'react';
import type { SceneGraph } from '../../../core/SceneGraph.js';
import { SceneChangeResetter } from '../../SceneChangeResetter.js';
import { usePreviewCamera } from './previewCamera.js';
import { usePreviewSelection } from './previewSelection.js';

/** A new scene clears the view's selection, the shell's selection and the camera preview. */
export function PreviewSceneReset({ sceneGraph }: { sceneGraph: SceneGraph | null }) {
  const endCameraPreview = usePreviewCamera()?.endPreview;
  const select = usePreviewSelection()?.select;
  const onNewScene = useCallback(() => {
    select?.(null);
    // The old scene's Camera3D is gone. Ending the preview lets FrameOnOpen frame the new scene.
    endCameraPreview?.();
  }, [select, endCameraPreview]);
  return <SceneChangeResetter sceneGraph={sceneGraph} onNewScene={onNewScene} />;
}
