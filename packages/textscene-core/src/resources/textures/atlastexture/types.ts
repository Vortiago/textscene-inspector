/**
 * AtlasTexture slice types: a sub-region of another Texture2D
 * (`scene/resources/atlas_texture.h`). Godot presents it at its own size, not
 * the sheet's (`get_width`/`get_height`, atlas_texture.cpp:33-53), and a
 * Control's minimum size reads that. No THREE.
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
   * The raw `atlas` reference (`ExtResource("id")`, `SubResource("id")` or a
   * `res://` path), or null. Raw because resolving it needs the owning file's
   * ExtResource table, which a leaf module does not take.
   */
  atlas: string | null;
  /**
   * The window into the atlas. A zero-size region means the whole image: Godot
   * falls back to the atlas dimensions (atlas_texture.cpp:33-53).
   */
  region: AtlasRect;
  /** Transparent padding around the region, widening the reported size (:33-42). */
  margin: AtlasRect;
  /**
   * `filter_clip`: Godot clamps the sampler to the region, so linear filtering
   * cannot bleed in neighbouring texels. A pixel crop is always clipped, which is
   * the `true` behaviour.
   */
  filterClip: boolean;
}

/**
 * Where an AtlasTexture's pixels come from and how big it claims to be. `width`
 * and `height` are Godot's `get_width`/`get_height`. `source` is the sampled atlas
 * rectangle, `dest` where it lands in the box, non-zero only with a `margin`.
 */
export interface AtlasTextureLayout {
  width: number;
  height: number;
  source: AtlasRect;
  dest: { x: number; y: number };
}
