/**
 * Whether a canvas item draws, as the dispatcher decides it for its own nodes: a pushed `visible`
 * over the authored one, and never while the editor's eye toggle hides its path.
 */

import { useAnimatedValueAt } from './contexts/AnimatedValueContext.js';
import { useOptionalSelection } from './contexts/SelectionContext.js';

/** `authored` is the node's `visible`, unset meaning Godot's default `true`. */
export function useCanvasItemVisible(path: string, authored: boolean | undefined): boolean {
  const animated = useAnimatedValueAt(path, 'visible', (value) => value[0] !== 0);
  const isHidden = useIsHiddenInEditor(path);
  return (animated ?? authored !== false) && !isHidden;
}

/** Whether the editor's eye toggle hides `path`. Outside a selection nothing is hidden. */
export function useIsHiddenInEditor(path: string): boolean {
  return useOptionalSelection()?.hiddenNodePaths.has(path) ?? false;
}
