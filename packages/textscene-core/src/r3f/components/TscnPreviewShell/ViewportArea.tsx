/**
 * The center viewport. Reads `useViewportMode()` and renders either the R3F
 * canvas (3D) or the pannable 2D canvas stage (2D). In 2D mode it feeds the
 * stage the root scene's nodes + resources so Control nodes lay out and
 * StyleBox/Texture refs resolve — kept as explicit props per ADR-0009 (the
 * two-mount SceneResources pattern; do NOT lift to an ambient provider).
 * Must live below `<ViewportModeProvider>` so it can read the mode the
 * toolbar writes.
 */
import { useMemo } from 'react';
import type { SceneGraph } from '../../../core/SceneGraph.js';
import { useViewportMode } from '../../contexts/ViewportModeContext.js';
import { has2DUIContent } from '../../controls/has2DUIContent.js';
import { TscnCanvas } from '../../TscnCanvas.js';
import { Canvas2DStage } from '../Canvas2DStage/Canvas2DStage.js';
import styles from './TscnPreviewShell.module.css';

export function ViewportArea({ sceneGraph }: { sceneGraph: SceneGraph | null }) {
  const { mode, setMode } = useViewportMode();
  const rootScene = sceneGraph?.scenes.get(sceneGraph.rootScene);
  const has2DUI = useMemo(() => has2DUIContent(rootScene?.nodes ?? []), [rootScene]);

  if (mode === '2D') {
    return (
      <Canvas2DStage
        nodes={rootScene?.nodes ?? []}
        internalResources={rootScene?.internalResources ?? []}
        externalResources={rootScene?.externalResources ?? []}
      />
    );
  }

  // 3D mode. Default per ADR-0006 is 3D; when the scene also carries 2D-UI
  // (Control/CanvasLayer) nodes, surface a hint so the overlay is discoverable
  // instead of the user staring at a viewport with no visible UI.
  return (
    <>
      <TscnCanvas />
      {has2DUI && (
        <button
          type="button"
          className={styles.viewportHint}
          onClick={() => setMode('2D')}
          title="This scene contains 2D UI — switch to the 2D overlay"
        >
          Contains 2D&nbsp;UI — switch to 2D
        </button>
      )}
    </>
  );
}
