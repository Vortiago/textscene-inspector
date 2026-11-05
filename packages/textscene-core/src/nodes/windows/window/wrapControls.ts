/**
 * `wrap_controls` (`window.cpp:1629-1632`): an embedded window's final size, from its Controls laid
 * out at its loaded size. Pure: no React, no THREE.
 */

import type { Vector2 } from '../../../godot/math/vector';
import { embeddedWindowSize } from '../../../godot/scene/window';
import { createSolveContext, solveControlTree } from '../../../r3f/controls/native/controlRectSolver';
import type { NativeTheme } from '../../../r3f/controls/native/nativeTheme';
import type { SolveNode } from '../../../r3f/controls/native/solveTree';
import type { TextMeasurer } from '../../../r3f/controls/native/solverRegistry';
import { windowContentsMinimumSize } from './contentsMinimumSize';
import type { WindowProperties } from './types';

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
  const loaded = props.size;
  const sizing = { minSize: props.min_size, maxSize: props.max_size, wrapControls: props.wrap_controls };
  if (!sizing.wrapControls) return embeddedWindowSize(loaded, sizing, loaded);
  const viewport = { x: 0, y: 0, w: loaded.x, h: loaded.y };
  const solved = solveControlTree([window], viewport, createSolveContext(theme, measureText));
  return embeddedWindowSize(loaded, sizing, windowContentsMinimumSize(window, solved, theme));
}
