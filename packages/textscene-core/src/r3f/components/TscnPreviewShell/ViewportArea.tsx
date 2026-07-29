/**
 * The center viewport. Reads `useViewportMode()` and renders either the R3F
 * canvas (3D) or the pannable 2D canvas stage (2D). In 2D mode it feeds the
 * stage the root scene's nodes + resources so Control nodes lay out and
 * StyleBox/Texture refs resolve — kept as explicit props per ADR-0009 (the
 * two-mount SceneResources pattern; do NOT lift to an ambient provider).
 * Must live below `<ViewportModeProvider>` so it can read the mode the
 * toolbar writes.
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

/** Stable prune so `useLiveSceneNodes`' memo doesn't recompute each render. */
const NOT_A_VIEWPORT = (node: TscnNode): boolean => !isViewportBoundary(node.type);

export function ViewportArea({ sceneGraph }: { sceneGraph: SceneGraph | null }) {
  const { mode, setMode } = useViewportMode();
  const rootScene = sceneGraph?.scenes.get(sceneGraph.rootScene);
  // From the LIVE scene tree, so 2D content INSIDE an instanced sub-scene (a
  // HUD, embedded sprites) is detected too — not just inline CanvasItems. Grows
  // when a sub-scene loads, so the hint appears once the instance resolves.
  // Stops at a sub-viewport: its Controls are visible only through a viewport
  // surface, so counting them would offer "switch to 2D" for a scene whose 2D
  // workspace shows nothing. A SubViewportContainer is itself a Control and
  // still counts, which is right — it DOES draw something there (ADR-0030).
  const has2DContent = useLiveSceneNodes(isCanvasItemNode, NOT_A_VIEWPORT).length > 0;

  if (mode === '2D') {
    return (
      <>
        <Canvas2DStage
          nodes={rootScene?.nodes ?? []}
          internalResources={rootScene?.internalResources ?? []}
          externalResources={rootScene?.externalResources ?? []}
        />
        <ViewportControlsHelp mode="2D" />
      </>
    );
  }

  // 3D workspace (Node3D content only, like Godot's editor). When the scene
  // ALSO carries CanvasItem content — a HUD, embedded sprites/tilemaps — that
  // content only renders in the 2D workspace, so surface a hint.
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
