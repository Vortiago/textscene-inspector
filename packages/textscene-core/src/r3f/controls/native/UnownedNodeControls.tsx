/**
 * The Controls inside an unowned node (`LiveNode.isUnowned`), drawn by the native Control walker in
 * the run of draw sequences the node holds. A Control root anchors to the zero rect of its parent
 * canvas item (`control.cpp` `get_parent_anchorable_rect`). Loaded lazily, as `ViewportControls`
 * is, so a canvas with none loads none.
 */

import { useCallback, useMemo } from 'react';
import '../index.js';
import type { Rect2 } from '../../../godot/math/rect2';
import type { LiveNode } from '../../../resources/liveNode';
import type { SolvedControl } from './controlRectSolver';
import { useProjectSettings } from '../../contexts/ProjectSettingsContext';
import { usePaintRange } from '../../contexts/PaintOrderContext';
import { useSceneResources } from '../../SceneResourcesContext';
import { useBuildUnownedTree } from './buildSolveTree';
import { ControlCanvasWalker } from './ControlCanvasWalker';
import { nativeTheme } from './nativeTheme';
import { measureText } from './text/measurer';

const ZERO_RECT: Rect2 = { x: 0, y: 0, w: 0, h: 0 };

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
  // The tree's first node is the Control root the placement holds, which the tile layer sorts on.
  const { reportRootRect } = node;
  const onSolved = useCallback(
    (solved: ReadonlyMap<string, SolvedControl>) => {
      const rect = tree[0] && solved.get(tree[0].path)?.rect;
      if (rect) reportRootRect?.(rect);
    },
    [tree, reportRootRect]
  );
  return (
    <ControlCanvasWalker
      tree={tree}
      generation={generation}
      viewport={ZERO_RECT}
      theme={theme}
      measurer={measureText}
      onSolved={onSolved}
    />
  );
}
