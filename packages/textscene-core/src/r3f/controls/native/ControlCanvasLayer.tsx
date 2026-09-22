/**
 * `<ControlCanvasLayer>` — the native (WebGL) Control mount point, where the
 * 2D viewport draws Control nodes as canvas items. Mounted by
 * `World2DContents` as a sibling right after `<NodeDispatcher>`, inside the
 * same `SceneResourcesProvider` — resources come from that ambient context
 * (ADR-0009), matching how the sibling `<NodeDispatcher>` reads them, rather
 * than a second explicit-props path.
 *
 * Wires the three pieces the walker needs: `buildSolveTree` (the live-tree
 * walk into `SolveNode`s), the viewport rect + theme scale from
 * `useProjectSettings()` (a project's `display/window/size/viewport_*` and
 * `gui/theme/default_theme_scale` — NOT the hardcoded 1152x648/scale-1 a
 * module constant would silently apply to every project), and
 * `<ControlCanvasWalker>` to solve + draw.
 *
 * Also provides the LAYER-0 `CanvasModulateContext` scope — the one a native
 * Control with no enclosing `CanvasLayer` shares with the 2D world, since
 * both live on the same default canvas in Godot. `NodeDispatcher.tsx`
 * computes the identical `canvasModulateColor(nodes)` for its own root nodes;
 * this mount point is the Control tree's equivalent root, so it scans the
 * SAME root list rather than inheriting anything from the world canvas's own
 * provider (a `CanvasLayer` node further down gets its OWN fresh scope from
 * its `Native` painter, `canvaslayer/Component.tsx` — this one never
 * reaches inside one, matching `canvasModulateColor`'s own "does not descend
 * into a CanvasLayer" rule).
 */
import { useMemo } from 'react';
import type { TscnNode } from '../../../parser/types';
import { useSceneResources } from '../../SceneResourcesContext';
import { useProjectSettings } from '../../contexts/ProjectSettingsContext';
import { useBuildSolveTree } from './buildSolveTree';
import { nativeTheme } from './nativeTheme';
import type { Rect2 } from './rect';
import { ControlCanvasWalker } from './ControlCanvasWalker';
import { canvasModulateColor, CanvasModulateContext } from '../../canvasModulate';
import { declaredCanvasLayers, layerRanks } from '../../canvasPaintOrder';
import { LayerRanksProvider } from '../../contexts/PaintOrderContext';
import { measureText } from './text/measurer';

export interface ControlCanvasLayerProps {
  nodes: readonly TscnNode[];
}

/**
 * Force the previewed root node(s) visible. Godot UI scenes are frequently
 * authored with the root `visible = false` (a modal a script toggles on); a
 * previewer shows it regardless. A shallow map keeps the SceneGraph untouched
 * and only affects the ROOT — child visibility (and `hiddenNodePaths`) still
 * applies further down, via `ControlCanvasWalker`.
 */
function showRoots(nodes: readonly TscnNode[]): readonly TscnNode[] {
  return nodes.map((n) =>
    (n.properties as { visible?: boolean } | undefined)?.visible === false
      ? { ...n, properties: { ...n.properties, visible: true } }
      : n
  );
}

export function ControlCanvasLayer({ nodes }: ControlCanvasLayerProps) {
  const { externalResources, internalResources } = useSceneResources();
  const rootNodes = useMemo(() => showRoots(nodes), [nodes]);
  const { tree, generation } = useBuildSolveTree(rootNodes, externalResources, internalResources);

  const { viewportSize, themeScale } = useProjectSettings();
  const theme = useMemo(() => nativeTheme(themeScale), [themeScale]);
  const viewport: Rect2 = useMemo(
    () => ({ x: 0, y: 0, w: viewportSize.width, h: viewportSize.height }),
    [viewportSize.width, viewportSize.height]
  );
  // The RAW roots, not the showRoots copy: `canvasModulateColor` propagates
  // visibility, so forcing a root visible here would find a CanvasModulate that
  // `NodeDispatcher`/`World2DCanvas` — which read `nodes` — correctly skip, and
  // one canvas would be drawn with two different tints.
  const canvasModulate = useMemo(() => canvasModulateColor(nodes), [nodes]);
  // The same ranks `NodeDispatcher` derives, from the same nodes — this walk is
  // its SIBLING rather than its descendant, so it cannot inherit them, and a
  // Control ranked against a different layer set than the world would order
  // against it wrongly.
  const ranks = useMemo(() => layerRanks(declaredCanvasLayers(rootNodes)), [rootNodes]);

  return (
    <CanvasModulateContext.Provider value={canvasModulate}>
      <LayerRanksProvider value={ranks}>
        <ControlCanvasWalker
          tree={tree}
          generation={generation}
          viewport={viewport}
          theme={theme}
          measurer={measureText}
        />
      </LayerRanksProvider>
    </CanvasModulateContext.Provider>
  );
}
