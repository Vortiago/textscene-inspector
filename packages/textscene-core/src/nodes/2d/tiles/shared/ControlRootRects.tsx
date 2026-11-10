/**
 * Solves the Control root of each tile scene, so a scene tile sorts on the position its minimum size
 * and grow direction leave. Loaded lazily, so a canvas with no Control scene tile loads no solver.
 */

import { useEffect, useMemo } from 'react';
import type { Rect2 } from '../../../../godot/math/rect2';
import type { TileScene } from '../../../../resources/tileset/types';
import { usePaintRange } from '../../../../r3f/contexts/PaintOrderContext';
import { useProjectSettings } from '../../../../r3f/contexts/ProjectSettingsContext';
import { useSceneResources } from '../../../../r3f/SceneResourcesContext';
import { useBuildUnownedTree } from '../../../../r3f/controls/native/buildSolveTree';
import { createSolveContext, solveControlTree } from '../../../../r3f/controls/native/controlRectSolver';
import { nativeTheme } from '../../../../r3f/controls/native/nativeTheme';
import { measureText } from '../../../../r3f/controls/native/text/measurer';
import { NO_RECTS, type ControlRoot } from './useSceneTileNodes';

const ZERO_RECT: Rect2 = { x: 0, y: 0, w: 0, h: 0 };

interface ControlRootRectsProps {
  roots: readonly ControlRoot[];
  onRects: (rects: ReadonlyMap<TileScene, Rect2>) => void;
}

export default function ControlRootRects({ roots, onRects }: ControlRootRectsProps) {
  const { externalResources, internalResources } = useSceneResources();
  const { themeScale } = useProjectSettings();
  const theme = useMemo(() => nativeTheme(themeScale), [themeScale]);
  // A name of its own per scene, so two scenes whose roots share a name keep their own paths.
  const nodes = useMemo(() => roots.map(({ node }, index) => ({ ...node, name: `@Root@${index}` })), [roots]);
  const { tree, generation } = useBuildUnownedTree(
    nodes,
    externalResources,
    internalResources,
    usePaintRange()
  );
  const rects = useMemo(() => {
    const solved = solveControlTree(tree, ZERO_RECT, createSolveContext(theme, measureText));
    const rectOf = new Map<TileScene, Rect2>();
    roots.forEach(({ scene }, index) => {
      const rect = solved.get(nodes[index]!.name)?.rect;
      if (rect) rectOf.set(scene, rect);
    });
    return rectOf;
    // `generation` is a cache-buster, as in `ControlCanvasWalker`: a resource can load under the same tree.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roots, nodes, tree, generation, theme]);
  useEffect(() => onRects(rects), [rects, onRects]);
  // Unmount clears the rects, so a scene that becomes a Control root again starts from its offsets.
  useEffect(() => () => onRects(NO_RECTS), [onRects]);
  return null;
}
