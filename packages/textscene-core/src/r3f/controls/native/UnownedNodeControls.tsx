/**
 * The Controls inside an unowned node (`LiveNode.isUnowned`), drawn by the native Control walker in
 * the run of draw sequences the node holds. A Control root anchors to the zero rect of its parent
 * canvas item (`control.cpp` `get_parent_anchorable_rect`). Loaded lazily, as `ViewportControls`
 * is, so a canvas with none loads none.
 */

import { useCallback, useMemo } from 'react';
import '../index.js';
import type { Vector2 } from '../../../godot/math/vector';
import type { LiveNode } from '../../../resources/liveNode';
import type { SolvedControl } from './controlRectSolver';
import { useProjectSettings } from '../../contexts/ProjectSettingsContext';
import { usePaintRange } from '../../contexts/PaintOrderContext';
import { useSceneResources } from '../../SceneResourcesContext';
import { useBuildUnownedTree } from './buildSolveTree';
import { ControlCanvasWalker, ZERO_RECT } from './ControlCanvasWalker';
import { nativeTheme } from './nativeTheme';
import { measureText } from './text/measurer';

export default function UnownedNodeControls({ node }: { node: LiveNode }) {
  const { externalResources, internalResources } = useSceneResources();
  const { themeScale } = useProjectSettings();
  const theme = useMemo(() => nativeTheme(themeScale), [themeScale]);
  const nodes = useMemo(() => [node], [node]);
  const { tree, generation } = useBuildUnownedTree(
    nodes,
    externalResources,
    internalResources,
    usePaintRange()
  );
  // The placement's position is the one the tile sets on a Control root before the snap.
  const placement = (node.properties as { position: Vector2 }).position;
  // The first tree node is the Control root the placement holds, which the tile layer sorts on.
  const rootPath = tree[0]?.path;
  const { reportRootRect } = node;
  const onSolved = useCallback(
    (solved: ReadonlyMap<string, SolvedControl>) => {
      const rect = rootPath && solved.get(rootPath)?.rect;
      if (rect) reportRootRect?.(rect);
    },
    [rootPath, reportRootRect]
  );
  return (
    <ControlCanvasWalker
      tree={tree}
      generation={generation}
      viewport={ZERO_RECT}
      theme={theme}
      measurer={measureText}
      rootOffset={placement}
      onSolved={onSolved}
    />
  );
}
