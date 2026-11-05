/**
 * `wrap_controls` (`window.cpp:1629-1632`): an embedded window's final size, from its Controls laid
 * out at its loaded size. Pure: no React, no THREE.
 */

import type { Vector2 } from '../../../godot/math/vector';
import { embeddedWindowSize } from '../../../godot/scene/window';
import { createSolveContext, solveControlTree } from '../../../r3f/controls/native/controlRectSolver';
import type { NativeTheme } from '../../../r3f/controls/native/nativeTheme';
import type { SolveNode } from '../../../r3f/controls/native/solveTree';
import {
  controlSolverRegistry,
  type SolveContext,
  type TextMeasurer,
} from '../../../r3f/controls/native/solverRegistry';
import { windowContentsMinimumSize } from './contentsMinimumSize';
import type { WindowProperties } from './types';

/**
 * A subclass's registered minimum, such as PopupPanel's, reads no rect. The base rule reads each
 * child's position, so it lays the Controls out at the loaded size first.
 */
function contentsMinimumSize(window: SolveNode, ctx: SolveContext): Vector2 {
  if (controlSolverRegistry.minimumSize(window.node.type)) return ctx.combinedMinimumSize(window);
  const { size } = window.node.properties as WindowProperties;
  return windowContentsMinimumSize(
    window,
    solveControlTree([window], { x: 0, y: 0, w: size.x, h: size.y }, ctx)
  );
}

/**
 * The size `window` takes once its Controls are ready. Godot wraps at `NOTIFICATION_READY`, after
 * the Controls laid out at the loaded size, so their positions are the ones that size gives.
 */
export function wrappedWindowSize(
  window: SolveNode,
  theme: NativeTheme,
  measureText: TextMeasurer | null
): Vector2 {
  const props = window.node.properties as WindowProperties;
  const limits = { minSize: props.min_size, maxSize: props.max_size };
  if (!props.wrap_controls) return embeddedWindowSize(props.size, limits);
  return embeddedWindowSize(
    props.size,
    limits,
    contentsMinimumSize(window, createSolveContext(theme, measureText))
  );
}
