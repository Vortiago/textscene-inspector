/**
 * The shortest range Godot's light buffer holds for a positional light: omni and spot at 4.6.3
 * `light_storage.cpp:895`, area at 4.7.2 `:1060`.
 */
const LIGHT_BUFFER_MIN_RANGE = 0.001;

/** `range` as the light buffer holds it. */
export function lightBufferRange(range: number): number {
  return Math.max(LIGHT_BUFFER_MIN_RANGE, range);
}
