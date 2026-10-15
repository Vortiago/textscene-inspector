/**
 * The byte Godot stores for a 0..1 float32, read back as 0..1. Godot narrows the value to
 * float32, widens it to double only for the `* 255.0`, and casts to an unsigned byte, which
 * truncates (`rendering_server.cpp:713-716`, `render_forward_clustered.cpp:981`).
 */
export function unitByte(value: number): number {
  const scaled = Math.fround(value) * 255.0;
  return Math.trunc(Math.min(255, Math.max(0, scaled))) / 255;
}
