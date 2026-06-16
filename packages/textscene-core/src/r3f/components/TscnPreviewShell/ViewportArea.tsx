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
import { hasCanvasContent } from '../../workspaceForScene.js';
import { TscnCanvas } from '../../TscnCanvas.js';
import { Canvas2DStage } from '../Canvas2DStage/Canvas2DStage.js';
import styles from './TscnPreviewShell.module.css';

export function ViewportArea({ sceneGraph }: { sceneGraph: SceneGraph | null }) {
  const { mode, setMode } = useViewportMode();
  const rootScene = sceneGraph?.scenes.get(sceneGraph.rootScene);
  const has2DContent = useMemo(() => hasCanvasContent(rootScene?.nodes ?? []), [rootScene]);

  if (mode === '2D') {
    return (
      <Canvas2DStage
        nodes={rootScene?.nodes ?? []}
        internalResources={rootScene?.internalResources ?? []}
        externalResources={rootScene?.externalResources ?? []}
      />
    );
  }

  // 3D workspace (Node3D content only, like Godot's editor). When the scene
  // ALSO carries CanvasItem content — a HUD, embedded sprites/tilemaps — that
  // content only renders in the 2D workspace, so surface a hint.
  return (
    <>
      <TscnCanvas />
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
