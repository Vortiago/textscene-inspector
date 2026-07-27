/**
 * Where one atlas source's batched mesh sits inside a tile layer's draw
 * position.
 *
 * Godot interleaves a layer's cells across atlas sources in scan order; we
 * batch one mesh per source, so the sources need a deterministic order among
 * themselves. That order is a nudge, not a draw position of its own — it has to
 * fit in the band between this layer's position and whatever draws next, or the
 * layer's tiles overtake the row in front of them.
 *
 * A FIXED nudge cannot promise that. The band narrows as a scene grows: a
 * y-sorted layer decomposes into one draw position per distinct tile row, and
 * sibling subtrees divide the enclosing fine range. On the vendored isometric
 * dungeon the band is ~0.000149 while a fixed `Z_INDEX_STEP / 1024` step
 * reaches 0.00039 by the fifth atlas source — enough for a door tile to jump in
 * front of the wall row that should hide it.
 *
 * Expressing the nudge as a FRACTION of the band makes that unrepresentable:
 * every source lands strictly between 0 and `band`, in index order, however
 * narrow the band gets.
 */
export function tileSourceZ(sourceIndex: number, sourceCount: number, band: number): number {
  return ((sourceIndex + 1) / (sourceCount + 1)) * band;
}
