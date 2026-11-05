/**
 * Whether a canvas item draws, as the dispatcher decides it for its own nodes: a pushed `visible`
 * over the authored one, and never while the editor's eye toggle hides its path.
 */

import { useAnimatedValueAt } from './contexts/AnimatedValueContext.js';
import { useOptionalSelection } from './contexts/SelectionContext.js';

/** `authored` is the node's `visible`, unset meaning Godot's default `true`. */
export function useCanvasItemVisible(path: string, authored: boolean | undefined): boolean {
  const animated = useAnimatedValueAt(path, 'visible', (value) => value[0] !== 0);
  const isHidden = useOptionalSelection()?.hiddenNodePaths.has(path) ?? false;
  return (animated ?? authored !== false) && !isHidden;
}
