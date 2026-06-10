/** Parse Godot `PackedVector3Array(x, y, z, x, y, z, ...)` into a flat Float32Array. */
export function parsePackedVector3Array(value: string): Float32Array {
  const match = value.match(/^PackedVector3Array\s*\(([\s\S]*)\)$/);
  if (!match) {
    throw new Error(`Invalid PackedVector3Array format: ${value}`);
  }
  const inner = match[1]!.trim();
  if (inner === '') return new Float32Array(0);
  const nums = inner.split(',').map((s) => parseFloat(s.trim()));
  if (nums.some((n) => Number.isNaN(n))) {
    throw new Error(`Invalid number in PackedVector3Array: ${value}`);
  }
  return new Float32Array(nums);
}
