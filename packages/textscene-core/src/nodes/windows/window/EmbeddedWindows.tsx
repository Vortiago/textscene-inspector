/**
 * The windows one viewport embeds, drawn over its canvas: each window's frame, title and close icon,
 * then the window's own target, in the stack's order (`Viewport::_sub_window_update`,
 * `scene/main/viewport.cpp:342-401`).
 */
import { useMemo } from 'react';
import type { SolveNode } from '../../../r3f/controls/native/solveTree';
import type { NativeTheme } from '../../../r3f/controls/native/nativeTheme';
import type { Vector2 } from '../../../godot/math/vector';
import { parentPathOf } from '../../../utils/nodePath';
import { subwindowStack, type StackedWindow } from './embedding';
import { EmbeddedWindowFrame } from './EmbeddedWindowFrame';
import { SubwindowCanvasScope } from './SubwindowCanvasScope';
import type { WindowProperties } from './types';

interface EmbeddedWindowsProps {
  /** The windows `useBuildSolveTree` lists for the embedder, in pre-order. */
  windows: readonly SolveNode[];
  /** The embedder's visible size, which a centred window centres in. */
  embedderSize: Vector2;
  theme: NativeTheme;
}

interface StackEntry extends StackedWindow {
  solveNode: SolveNode;
}

/** Whether the embedder registers the window: only a visible one enters the stack (`window.cpp:1552`). */
function isShown(window: SolveNode): boolean {
  return !window.hidden && (window.node.properties as WindowProperties).visible;
}

/**
 * The stack entries in pre-order. `get_parent_visible_window` is the nearest visible window above,
 * and each such window comes earlier in pre-order, so it already has its entry.
 */
function stackEntries(windows: readonly SolveNode[]): StackEntry[] {
  const byPath = new Map<string, StackEntry>();
  for (const solveNode of windows) {
    const props = solveNode.node.properties as WindowProperties;
    byPath.set(solveNode.path, {
      solveNode,
      unfocusable: props.unfocusable,
      alwaysOnTop: props.always_on_top,
      exclusive: props.exclusive,
      parent: nearestWindowAbove(solveNode.path, byPath),
    });
  }
  return [...byPath.values()];
}

function nearestWindowAbove(path: string, byPath: ReadonlyMap<string, StackEntry>): StackEntry | null {
  for (let above = parentPathOf(path); above !== null; above = parentPathOf(above)) {
    const entry = byPath.get(above);
    if (entry) return entry;
  }
  return null;
}

export function EmbeddedWindows({ windows, embedderSize, theme }: EmbeddedWindowsProps) {
  const stack = useMemo(() => subwindowStack(stackEntries(windows.filter(isShown))), [windows]);
  if (stack.order.length === 0) return null;
  return (
    <SubwindowCanvasScope>
      {stack.order.map((entry, drawIndex) => (
        <EmbeddedWindowFrame
          key={entry.solveNode.path}
          solveNode={entry.solveNode}
          isFocused={entry === stack.focused}
          drawIndex={drawIndex}
          embedderSize={embedderSize}
          theme={theme}
        />
      ))}
    </SubwindowCanvasScope>
  );
}
