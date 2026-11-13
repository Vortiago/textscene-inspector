/**
 * The walk over one Control tree at the canvas origin, in a 1152x648 viewport at theme scale 1, with
 * the bundled measurer: the painters of the tree and of its internal Controls.
 *
 * @canonical A walker render of one Control tree in a test
 */
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { ControlCanvasWalker } from '../ControlCanvasWalker';
import { nativeTheme } from '../nativeTheme';
import type { SolveNode } from '../solveTree';
import { measureText } from '../text/measurer';
import { withPaintRanges } from './solveNode';

export const WALK_VIEWPORT = { x: 0, y: 0, w: 1152, h: 648 };

export function walked(root: SolveNode) {
  return ReactThreeTestRenderer.create(
    <ControlCanvasWalker
      tree={withPaintRanges([root])}
      generation={0}
      viewport={WALK_VIEWPORT}
      theme={nativeTheme(1)}
      measurer={measureText}
    />
  );
}
