/**
 * ViewportTexture slice types.
 *
 * There is no decoded DATA shape here, and that is the type's defining property:
 * a ViewportTexture carries a `viewport_path` NodePath and nothing else the
 * renderer can use — the pixels are the live render target a `<SubViewport>`
 * publishes. The path resolution therefore lives with the registry that owns
 * those targets (`r3f/viewportTexturePath.ts`), and the slice's own surface is
 * just the claim plus the type name a host checks before skipping the file path.
 */

/** The `type` a ViewportTexture sub-resource declares. */
export const VIEWPORT_TEXTURE_TYPE = 'ViewportTexture';
