/**
 * ViewportTexture slice types. There is no decoded data shape: a ViewportTexture
 * carries only a `viewport_path`, and its pixels are a `<SubViewport>`'s live
 * target. Path resolution lives with that registry (`r3f/viewportTexturePath.ts`).
 */

/** The `type` a ViewportTexture sub-resource declares. */
export const VIEWPORT_TEXTURE_TYPE = 'ViewportTexture';
