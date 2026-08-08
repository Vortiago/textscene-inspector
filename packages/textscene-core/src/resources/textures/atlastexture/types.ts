/** Typed view of an `AtlasTexture` sub-resource block. Pure `.ts`, no THREE. */

/** A `Rect2(x, y, width, height)` literal, in atlas pixels (top-left origin, like Godot). */
export interface AtlasRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface AtlasTexture {
  /** Raw `atlas` reference — `ExtResource("id")`, `SubResource("id")` or a `res://` path. Null when absent. */
  atlas: string | null;
  region: AtlasRect;
  margin: AtlasRect;
  /**
   * `filter_clip` — Godot clamps the sampler to the region when set, so linear
   * filtering cannot bleed in neighbouring atlas texels at the region's edge.
   * Parsed for completeness; a pixel crop is unconditionally clipped, which is
   * the `true` behaviour (see this folder's `comparison.md`).
   */
  filterClip: boolean;
}

/**
 * Where an AtlasTexture's pixels come from and how big it claims to be.
 *
 * `width`/`height` are Godot's `get_width`/`get_height` — the size a Control's
 * minimum-size solve reads and the size of the box the region is composed into.
 * `source` is the atlas rectangle actually sampled, `dest` where that rectangle
 * lands inside the box (non-zero only with a `margin`, whose remaining area
 * stays transparent).
 */
export interface AtlasTextureLayout {
  width: number;
  height: number;
  source: AtlasRect;
  dest: { x: number; y: number };
}
