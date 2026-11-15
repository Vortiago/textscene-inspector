/** A `Vector2` that keeps its identity while its numbers stay, for a memo or effect that keys on it. */
import { useMemo } from 'react';
import type { Vector2 } from '../../godot/math/vector';

export function useStableVector2({ x, y }: Vector2): Vector2 {
  return useMemo(() => ({ x, y }), [x, y]);
}
