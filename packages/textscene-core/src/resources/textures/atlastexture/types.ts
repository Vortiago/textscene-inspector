/**
 * AtlasTexture slice types — a sub-region of another Texture2D.
 *
 * Godot's `AtlasTexture` (`scene/resources/atlas_texture.h`) wraps an `atlas`
 * texture plus a `region` Rect2 (and a `margin`/`filter_clip` the preview does
 * not sample). Decoding one answers the only question a renderer has: WHICH
 * image, and WHICH window into it.
 */

/** The `type` an AtlasTexture sub-resource declares. */
export const ATLAS_TEXTURE_TYPE = 'AtlasTexture';

/** An AtlasTexture sub-region, in atlas pixels (top-left origin, like Godot). */
export interface AtlasRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface AtlasTextureData {
  /**
   * The raw `atlas` reference — `ExtResource("id")` or a `res://` path — or null
   * when absent. Raw because resolving it needs the owning file's ExtResource
   * table, which the decode deliberately does not take (see `decode.ts`).
   */
  atlas: string | null;
  /**
   * The window into the atlas. Absent means "the whole image" — Godot's own rule
   * for a zero-size region (`AtlasTexture::get_width` falls back to the atlas
   * dimensions, `scene/resources/atlas_texture.cpp:33-42`).
   */
  region?: AtlasRegion;
}
