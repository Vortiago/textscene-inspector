/**
 * Godot's UV space: the origin is the image's top-left, so V runs down. A renderer that uploads an
 * image bottom-up, as three does with `flipY`, samples Godot's `v` at `1 - v`.
 */

/** The V a bottom-up upload samples for Godot's `v`. Its own inverse, so it turns either way. */
export function bottomUpV(v: number): number {
  return 1 - v;
}
