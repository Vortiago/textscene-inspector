/** The distinct positions of a flat xyz array, for the tests that compare a build with Godot's. */

export function distinctPositions(positions: ArrayLike<number>): [number, number, number][] {
  const byKey = new Map<string, [number, number, number]>();
  for (let i = 0; i < positions.length; i += 3) {
    const position: [number, number, number] = [positions[i]!, positions[i + 1]!, positions[i + 2]!];
    byKey.set(position.join(','), position);
  }
  return [...byKey.values()];
}
