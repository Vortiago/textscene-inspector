/**
 * The center viewport. Reads `useViewportMode()` and renders either the R3F
 * canvas (3D) or the pannable 2D canvas stage (2D). In 2D mode it feeds the
 * stage the root scene's nodes + resources so Control nodes lay out and
 * StyleBox/Texture refs resolve — kept as explicit props per ADR-0009 (the
 * two-mount SceneResources pattern; do NOT lift to an ambient provider).
 * Must live below `<ViewportModeProvider>` so it can read the mode the
 * toolbar writes.
 */
import { lazy, Suspense, useMemo } from 'react';
import type { SceneGraph } from '../../../core/SceneGraph.js';
import { useViewportMode } from '../../contexts/ViewportModeContext.js';
import { isCanvasItemNode } from '../../workspaceForScene.js';
import { useLiveSceneNodes, useLiveTreeVersion } from '../../useLiveSceneTree.js';
import { useResourceLoader } from '../../../resources/useResource.js';
import { isViewportBoundary } from '../../../nodes/viewport/subviewport/viewportBoundary.js';
import {
  collectControlRasterViewports,
  type SceneScopeSource,
} from '../../../nodes/viewport/subviewport/controlRasterViewports.js';
import type { TscnNode } from '../../../parser/types.js';
import { TscnCanvas } from '../../TscnCanvas.js';
import { Canvas2DStage } from '../Canvas2DStage/Canvas2DStage.js';
import { ViewportControlsHelp } from '../ViewportControlsHelp/ViewportControlsHelp.js';
import styles from './TscnPreviewShell.module.css';

/** Stable prune so `useLiveSceneNodes`' memo doesn't recompute each render. */
const NOT_A_VIEWPORT = (node: TscnNode): boolean => !isViewportBoundary(node.type);

/** No PackedScene cache mounted yet (first paint, isolated tests). */
const NO_SCENES: SceneScopeSource = { getCached: () => undefined };

// Lazy for the same reason `Canvas2DStage` lazy-loads the overlay: the host
// pulls the Control barrel, whose 15 component registrations have no business
// in the initial canvas-paint bundle. Mounted only when the CHEAP walk below
// finds a Control-only sub-viewport, so a scene without one never fetches it.
const ControlRasterHosts = lazy(() =>
  import('../../../nodes/viewport/subviewport/ControlRasterHost.js').then((m) => ({
    default: m.ControlRasterHosts,
  }))
);

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

  // The off-screen DOM rasters for Control-only sub-viewports (ADR-0030). They
  // live OUTSIDE the R3F canvas because they are DOM, and outside the mode
  // branch because they are neither workspace's content: nothing here is ever
  // seen directly — a viewport surface samples what they publish. Instanced
  // sub-scenes land after the parse, so the walk re-runs on the live-tree tick
  // like every other live-tree reader.
  const loader = useResourceLoader();
  const liveTreeVersion = useLiveTreeVersion(loader);
  const rasterViewports = useMemo(
    () =>
      collectControlRasterViewports(rootScene?.nodes ?? [], loader?.scenes ?? NO_SCENES, {
        internalResources: rootScene?.internalResources ?? [],
        externalResources: rootScene?.externalResources ?? [],
      }),
    // `liveTreeVersion` is an intentional cache-buster: it ticks when a
    // sub-scene finishes loading, which is when the walk can find more.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rootScene, loader, liveTreeVersion]
  );
  const rasterHosts =
    rasterViewports.length > 0 ? (
      <Suspense fallback={null}>
        <ControlRasterHosts viewports={rasterViewports} />
      </Suspense>
    ) : null;

  if (mode === '2D') {
    return (
      <>
        <Canvas2DStage
          nodes={rootScene?.nodes ?? []}
          internalResources={rootScene?.internalResources ?? []}
          externalResources={rootScene?.externalResources ?? []}
        />
        {rasterHosts}
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
      {rasterHosts}
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
