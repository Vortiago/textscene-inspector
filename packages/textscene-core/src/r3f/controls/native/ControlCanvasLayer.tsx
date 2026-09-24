/**
 * The WebGL Control mount point in the 2D viewport. `World2DContents` mounts it
 * beside `<NodeDispatcher>`, and it reads resources from the same ambient context
 * (ADR-0009). It feeds `buildSolveTree`, the project's viewport rect and theme
 * scale, and the layer-0 canvas modulate into `<ControlCanvasWalker>`.
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
 * Forces the roots visible: a UI root often authors `visible = false` for a script
 * to toggle. A shallow copy leaves the SceneGraph untouched, and child visibility
 * and `hiddenNodePaths` still apply in `ControlCanvasWalker`.
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

  // The project's `display/window/size/viewport_*` and `gui/theme/default_theme_scale`,
  // not a constant 1152x648 at scale 1.
  const { viewportSize, themeScale } = useProjectSettings();
  const theme = useMemo(() => nativeTheme(themeScale), [themeScale]);
  const viewport: Rect2 = useMemo(
    () => ({ x: 0, y: 0, w: viewportSize.width, h: viewportSize.height }),
    [viewportSize.width, viewportSize.height]
  );
  // A Control outside any `CanvasLayer` shares Godot's default canvas with the
  // world, so this scans the root list `NodeDispatcher` scans. The raw roots: a
  // root forced visible would find a CanvasModulate the world skips, and one
  // canvas would draw with two tints.
  const canvasModulate = useMemo(() => canvasModulateColor(nodes), [nodes]);
  // The ranks `NodeDispatcher` derives: this walk is its sibling, so it cannot
  // inherit them, and a different layer set would order Controls against the
  // world wrongly.
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
