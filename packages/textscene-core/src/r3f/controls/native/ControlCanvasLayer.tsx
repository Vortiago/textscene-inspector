/**
 * `<ControlCanvasLayer>` — the native (WebGL) Control mount point, where a
 * `useNativeControls` viewport draws Control nodes as canvas items,
 * superseding the DOM `<ControlOverlay>` (ADR-0003) the flag being off still
 * uses. Mounted by `World2DContents` as a sibling right after
 * `<NodeDispatcher>`, inside the same `SceneResourcesProvider` — resources
 * come from that ambient context (ADR-0009), matching how the sibling
 * `<NodeDispatcher>` reads them, rather than a second explicit-props path.
 *
 * Wires the three pieces the walker needs: `buildSolveTree` (the live-tree
 * walk into `SolveNode`s), the viewport rect + theme scale from
 * `useProjectSettings()` (a project's `display/window/size/viewport_*` and
 * `gui/theme/default_theme_scale` — NOT the hardcoded 1152x648/scale-1 a
 * module constant would silently apply to every project), and
 * `<ControlCanvasWalker>` to solve + draw.
 */
import { useMemo } from 'react';
import type { TscnNode } from '../../../parser/types';
import { useSceneResources } from '../../SceneResourcesContext';
import { useProjectSettings } from '../../contexts/ProjectSettingsContext';
import { useBuildSolveTree } from './buildSolveTree';
import { nativeTheme } from './nativeTheme';
import type { Rect2 } from './rect';
import { ControlCanvasWalker } from './ControlCanvasWalker';

export interface ControlCanvasLayerProps {
  nodes: readonly TscnNode[];
}

/**
 * Force the previewed root node(s) visible — the native twin of
 * `ControlOverlay.tsx`'s `showRoots`. Godot UI scenes are frequently authored
 * with the root `visible = false` (a modal a script toggles on); a previewer
 * shows it regardless. A shallow map keeps the SceneGraph untouched and only
 * affects the ROOT — child visibility (and `hiddenNodePaths`) still applies
 * further down, via `ControlCanvasWalker`.
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

  return (
    <ControlCanvasWalker
      tree={tree}
      generation={generation}
      viewport={viewport}
      theme={theme}
      measurer={null}
    />
  );
}
