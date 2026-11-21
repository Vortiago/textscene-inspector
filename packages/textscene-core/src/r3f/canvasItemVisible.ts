import { useAnimatedValueAt } from './contexts/AnimatedValueContext.js';

/** `authored` is the node's `visible`, unset meaning Godot's default `true`. */
export function useCanvasItemVisible(path: string, authored: boolean | undefined): boolean {
  const animated = useAnimatedValueAt(path, 'visible', (value) => value[0] !== 0);
  return animated ?? authored !== false;
}
