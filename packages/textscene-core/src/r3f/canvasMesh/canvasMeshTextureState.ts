/**
 * What a canvas mesh drawer's texture slot holds now, from what the loader reports and whether the
 * view is here. `useCanvasMeshTexture` reads it, and `CanvasMeshBody` draws by it.
 */

/** What a texture slot holds now. */
export type CanvasMeshTextureState =
  /** The slot names no texture. */
  | 'none'
  /** The slot names a texture that is not here yet. */
  | 'arriving'
  /** The slot names a texture that never draws. */
  | 'missing'
  /** The slot names a ViewportTexture whose target sits in a pass cycle the previewer cannot draw. */
  | 'cyclic'
  /** The texture draws. */
  | 'ready';

interface TextureFacts {
  missing: boolean;
  isCyclic: boolean;
  hasView: boolean;
  isArriving: boolean;
  /** True once the loader holds the texture, before its view is uploaded. */
  hasSource: boolean;
}

/** A texture the loader holds with no view yet is on its way: a large texture whose tiled upload runs. */
export function textureState({
  missing,
  isCyclic,
  hasView,
  isArriving,
  hasSource,
}: TextureFacts): CanvasMeshTextureState {
  if (isCyclic) return 'cyclic';
  if (missing) return 'missing';
  if (hasView) return 'ready';
  return isArriving || hasSource ? 'arriving' : 'none';
}
