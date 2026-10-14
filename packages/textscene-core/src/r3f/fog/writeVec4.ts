/** Writes one vec4 into `target` at vec4 index `slot`, with no array literal per write. `w` is 0 unless given. */
export function writeVec4(target: Float32Array, slot: number, x: number, y: number, z: number, w = 0): void {
  const offset = slot * 4;
  target[offset] = x;
  target[offset + 1] = y;
  target[offset + 2] = z;
  target[offset + 3] = w;
}
