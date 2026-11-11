/**
 * The WebGL Control mount point in the 2D viewport. `World2DContents` mounts it beside
 * `<NodeDispatcher>`, and it reads resources from the same ambient context (ADR-0009).
 * It feeds `buildSolveTree`, the project's viewport rect and theme scale, and the layer-0 canvas
 * modulate into `<ControlCanvasWalker>`. The windows the root window embeds draw over the Controls.
 */
import { useCallback, useEffect, useMemo } from 'react';
import type { TscnNode } from '../../../parser/types';
import { useSceneResources } from '../../SceneResourcesContext';
import { useGameViewportRect } from '../../gameViewportRect.js';
import { useProjectSettings } from '../../contexts/ProjectSettingsContext';
import { useControlRuns, usePublishControlOrigins } from '../../contexts/ControlYSortContext';
import { snapControlsToPixelsEnabled } from './controlPixelSnap';
import { controlOriginsOf } from './controlYSort';
import type { SolvedControl } from './controlRectSolver';
import { projectEmbedsSubwindows } from '../../../parser/projectSettingsParser';
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
  const { tree, generation, windows } = useBuildSolveTree(rootNodes, externalResources, internalResources);

  // The project's `gui/theme/default_theme_scale`, not a constant scale 1.
  const { themeScale, settings } = useProjectSettings();
  const theme = useMemo(() => nativeTheme(themeScale), [themeScale]);
  const viewport = useGameViewportRect();
  // A Control outside any `CanvasLayer` shares Godot's default canvas with the
  // world, so this scans the root list `NodeDispatcher` scans. The raw roots: a
  // root forced visible would find a CanvasModulate the world skips, and one
  // canvas would draw with two tints.
  const canvasModulate = useCanvasModulateColor(nodes);
  // The ranks `NodeDispatcher` derives: this walk is its sibling, so it cannot
  // inherit them, and a different layer set would order Controls against the
  // world wrongly.
  const ranks = useMemo(() => canvasLayerRanks(rootNodes), [rootNodes]);
  const embedderSize = useStableVector2({ x: viewport.w, y: viewport.h });

  // A y-sorted node in the world sorts its Control children on the origins this solve gives them.
  const publishOrigins = usePublishControlOrigins();
  const runs = useControlRuns();
  const snapToPixels = snapControlsToPixelsEnabled(settings);
  const onSolved = useCallback(
    (solved: ReadonlyMap<string, SolvedControl>) =>
      publishOrigins?.(controlOriginsOf(tree, solved, snapToPixels)),
    [publishOrigins, tree, snapToPixels]
  );
  // The origins outlive no layer: a later one at the same paths would sort on stale values.
  useEffect(() => () => publishOrigins?.(new Map()), [publishOrigins]);

  return (
    <CanvasModulateContext.Provider value={canvasModulate}>
      <LayerRanksProvider value={ranks}>
        <ControlCanvasWalker
          tree={tree}
          generation={generation}
          viewport={viewport}
          theme={theme}
          measurer={measureText}
          runs={runs}
          onSolved={onSolved}
        />
        {/* A window the root does not embed is a native one, drawn outside the game frame. */}
        {projectEmbedsSubwindows(settings) ? (
          <EmbeddedWindows windows={windows} embedderSize={embedderSize} forestPath="" theme={theme} />
        ) : null}
      </LayerRanksProvider>
    </CanvasModulateContext.Provider>
  );
}
