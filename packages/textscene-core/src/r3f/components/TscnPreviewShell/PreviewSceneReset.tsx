import { useCallback } from 'react';
import type { SceneGraph } from '../../../core/SceneGraph.js';
import { SceneChangeResetter } from '../../SceneChangeResetter.js';
import { usePreviewCamera } from './previewCamera.js';
import { usePreviewSelection } from './previewSelection.js';
import { useExpandedRows } from '../SceneTreeViewer/expandedRows.js';

const NO_ROWS: ReadonlySet<string> = new Set();

/** A new scene clears both selections, the expanded tree rows and the camera preview. */
export function PreviewSceneReset({ sceneGraph }: { sceneGraph: SceneGraph | null }) {
  const endCameraPreview = usePreviewCamera()?.endPreview;
  const select = usePreviewSelection()?.select;
  const setExpandedRows = useExpandedRows().set;
  const onNewScene = useCallback(() => {
    select?.(null);
    setExpandedRows(NO_ROWS);
    // The old scene's Camera3D is gone. Ending the preview lets FrameOnOpen frame the new scene.
    endCameraPreview?.();
  }, [select, setExpandedRows, endCameraPreview]);
  return <SceneChangeResetter sceneGraph={sceneGraph} onNewScene={onNewScene} />;
}
