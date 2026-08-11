/**
 * AtlasTexture slice types — a sub-region of another Texture2D.
 *
 * Godot's `AtlasTexture` (`scene/resources/atlas_texture.h`) wraps an `atlas`
 * texture plus a `region` Rect2, a `margin` that pads the reported size, and a
 * `filter_clip`. Decoding one answers the two questions a consumer has: WHICH
 * image and WHICH window into it, and — just as load-bearing — how big the
 * texture claims to BE, since Godot presents an AtlasTexture at its own size
 * rather than the sheet's (`get_width`/`get_height`, atlas_texture.cpp:33-53)
 * and a Control's minimum size reads exactly that.
 *
 * Pure `.ts`, no THREE — `build.ts` composes the layout into a texture.
 */

/** The `type` an AtlasTexture sub-resource declares. */
export const ATLAS_TEXTURE_TYPE = 'AtlasTexture';

/** A `Rect2(x, y, width, height)` literal, in atlas pixels (top-left origin, like Godot). */
export interface AtlasRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Typed view of an `AtlasTexture` sub-resource block. */
export interface AtlasTextureData {
  /**
   * The raw `atlas` reference — `ExtResource("id")`, `SubResource("id")` or a
   * `res://` path — or null when absent. Raw because resolving it needs the
   * owning file's ExtResource table, which the decode deliberately does not
   * take: keeping that out makes this a leaf module.
   */
  atlas: string | null;
  /**
   * The window into the atlas. A zero-size region means "the whole image", not
   * "an empty texture" — Godot falls back to the atlas dimensions
   * (atlas_texture.cpp:33-53) — which `atlasTextureLayout` resolves.
   */
  region: AtlasRect;
  /** Transparent padding around the region, widening the reported size (:33-42). */
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
