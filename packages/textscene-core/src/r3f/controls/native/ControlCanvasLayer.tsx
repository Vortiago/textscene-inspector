/**
 * The WebGL Control mount point in the 2D viewport. `World2DContents` mounts it beside
 * `<NodeDispatcher>`, and it reads resources from the same ambient context (ADR-0009).
 * It feeds `buildSolveTree`, the project's viewport rect and theme scale, and the layer-0 canvas
 * modulate into `<ControlCanvasWalker>`. The windows the root window embeds draw over the Controls.
 */
import { useMemo } from 'react';
import type { TscnNode } from '../../../parser/types';
import { useSceneResources } from '../../SceneResourcesContext';
import { useGameViewportRect } from '../../gameViewportRect.js';
import { useProjectSettings } from '../../contexts/ProjectSettingsContext';
import { useBuildSolveTree } from './buildSolveTree';
import { nativeTheme } from './nativeTheme';
import { ControlCanvasWalker } from './ControlCanvasWalker';
import { useCanvasModulateColor, CanvasModulateContext } from '../../canvasModulate';
import { canvasLayerRanks } from '../../canvasPaintOrder';
import { LayerRanksProvider } from '../../contexts/PaintOrderContext';
import { measureText } from './text/measurer';
import { EmbeddedWindows } from '../../../nodes/windows/window/EmbeddedWindows';
import { useStableVector2 } from '../../hooks/useStableVector2';

interface ControlCanvasLayerProps {
  nodes: readonly TscnNode[];
}

export function ControlCanvasLayer({ nodes }: ControlCanvasLayerProps) {
  const { externalResources, internalResources } = useSceneResources();
  const { tree, generation, windows } = useBuildSolveTree(nodes, externalResources, internalResources);

  // The project's `gui/theme/default_theme_scale`, not a constant scale 1.
  const { themeScale } = useProjectSettings();
  const theme = nativeTheme(themeScale);
  const viewport = useGameViewportRect();
  // A Control outside any `CanvasLayer` shares the world's default canvas, so this scans the dispatcher's roots.
  const canvasModulate = useCanvasModulateColor(nodes);
  // The ranks `NodeDispatcher` derives: this walk is its sibling, so it cannot
  // inherit them, and a different layer set would order Controls against the
  // world wrongly.
  const ranks = useMemo(() => canvasLayerRanks(nodes), [nodes]);
  const embedderSize = useStableVector2({ x: viewport.w, y: viewport.h });

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
        <EmbeddedWindows windows={windows} embedderSize={embedderSize} forestPath="" theme={theme} />
      </LayerRanksProvider>
    </CanvasModulateContext.Provider>
  );
}
