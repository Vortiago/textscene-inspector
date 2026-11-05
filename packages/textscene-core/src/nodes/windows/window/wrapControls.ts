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
import { windowContentScale } from './contentScale';
import type { WindowProperties } from './types';

/**
 * A subclass's registered minimum, such as PopupPanel's, reads no rect. The base rule reads each
 * child's position, so it lays the Controls out in the rect the loaded size gives them first.
 */
function contentsMinimumSize(window: SolveNode, ctx: SolveContext, layoutSize: Vector2): Vector2 {
  if (controlSolverRegistry.minimumSize(window.node.type)) return ctx.combinedMinimumSize(window);
  return windowContentsMinimumSize(
    window,
    solveControlTree([window], { x: 0, y: 0, w: layoutSize.x, h: layoutSize.y }, ctx)
  );
}

/**
 * `get_contents_minimum_size() * get_content_scale_factor()` (`window.cpp:2250`). The factor is the
 * one an integer stretch floors in `_update_viewport_size` (`:1240-1249`), which runs before READY.
 */
function scaledContentsMinimumSize(window: SolveNode, ctx: SolveContext): Vector2 {
  const { size, content_scale } = window.node.properties as WindowProperties;
  const { layoutSize, canvasScale: factor } = windowContentScale(size, content_scale);
  const minimum = contentsMinimumSize(window, ctx, layoutSize);
  return { x: minimum.x * factor, y: minimum.y * factor };
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
    scaledContentsMinimumSize(window, createSolveContext(theme, measureText))
  );
}
