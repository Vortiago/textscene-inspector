/**
 * The centre viewport: the R3F canvas in 3D, the 2D stage in 2D. The stage
 * gets the scene's nodes and resources as explicit props, not an ambient
 * provider (ADR-0009). A sub-viewport's offscreen pass mounts inside the
 * active canvas, since it needs an R3F root.
 */
import type { SceneGraph } from '../../../core/SceneGraph.js';
import { useViewportMode } from '../../contexts/ViewportModeContext.js';
import { isCanvasItemNode } from '../../workspaceForScene.js';
import { useLiveSceneNodes } from '../../useLiveSceneTree.js';
import { isViewportBoundary } from '../../../nodes/viewport/subviewport/viewportBoundary.js';
import type { TscnNode } from '../../../parser/types.js';
import { TscnCanvas } from '../../TscnCanvas.js';
import { Canvas2DStage } from '../Canvas2DStage/Canvas2DStage.js';
import { ViewportControlsHelp } from '../ViewportControlsHelp/ViewportControlsHelp.js';
import styles from './TscnPreviewShell.module.css';

/** A stable prune, so the memo of `useLiveSceneNodes` does not recompute each render. */
const NOT_A_VIEWPORT = (node: TscnNode): boolean => !isViewportBoundary(node.type);

export function ViewportArea({
  sceneGraph,
  scenePath,
}: {
  sceneGraph: SceneGraph | null;
  /** The path the host opened the scene under, whatever its parse gave. */
  scenePath: string;
}) {
  const { mode, setMode } = useViewportMode();
  const rootScene = sceneGraph?.scenes.get(sceneGraph.rootScene);
  // The live tree finds 2D content inside a sub-scene too. The walk stops at a
  // sub-viewport, whose Controls show only through a viewport surface. A
  // SubViewportContainer still counts, since it draws in 2D (ADR-0033).
  const has2DContent = useLiveSceneNodes(isCanvasItemNode, NOT_A_VIEWPORT).length > 0;

  if (mode === '2D') {
    return (
      <>
        <Canvas2DStage
          nodes={rootScene?.nodes ?? []}
          internalResources={rootScene?.internalResources ?? []}
          externalResources={rootScene?.externalResources ?? []}
          scenePath={scenePath}
        />
        <ViewportControlsHelp mode="2D" />
      </>
    );
  }

  // CanvasItem content renders only in the 2D workspace, so the 3D one shows a hint.
  return (
    <>
      <TscnCanvas />
      <ViewportControlsHelp mode="3D" />
      {has2DContent && (
        <button
          type="button"
          className={styles.viewportHint}
          onClick={() => setMode('2D')}
          title="This scene contains 2D content — switch to the 2D view"
        >
          Has 2D&nbsp;content — switch to 2D
        </button>
      )}
    </>
  );
}
