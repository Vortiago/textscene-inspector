/**
 * The Controls inside a node the scene does not list (`LiveNode.isUnowned`), drawn by the native
 * Control walker in the run of draw sequences the node holds. The world walk draws no Control, and
 * the scene's own Control forest never sees such a node. A Control root anchors to the zero rect of
 * its parent canvas item (`control.cpp` `get_parent_anchorable_rect`). Loaded lazily and through
 * the controls barrel, as `ViewportControls` is, so a canvas with none loads none.
 */

import { useMemo } from 'react';
import '../index.js';
import type { Rect2 } from '../../../godot/math/rect2';
import type { TscnNode } from '../../../parser/types';
import { useProjectSettings } from '../../contexts/ProjectSettingsContext';
import { usePaintRange } from '../../contexts/PaintOrderContext';
import { useSceneResources } from '../../SceneResourcesContext';
import { useBuildUnownedTree } from './buildSolveTree';
import { ControlCanvasWalker } from './ControlCanvasWalker';
import { nativeTheme } from './nativeTheme';
import { measureText } from './text/measurer';

const ZERO_RECT: Rect2 = { x: 0, y: 0, w: 0, h: 0 };

export default function UnownedNodeControls({ node }: { node: TscnNode }) {
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
  return (
    <ControlCanvasWalker
      tree={tree}
      generation={generation}
      viewport={ZERO_RECT}
      theme={theme}
      measurer={measureText}
    />
  );
}
