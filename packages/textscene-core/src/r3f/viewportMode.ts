/** `3D` and `2D` are the editor's views, `in-game` the game's start with no script run. */
export type ViewportMode = '2D' | '3D' | 'in-game';

export function isViewportMode(value: unknown): value is ViewportMode {
  return value === '2D' || value === '3D' || value === 'in-game';
}
