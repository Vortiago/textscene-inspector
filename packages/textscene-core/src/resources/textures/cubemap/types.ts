import type { SavedImage } from '../image/kind';

/** What a Cubemap resource draws, as the `CUBEMAP` kind decodes it. No THREE. */
export type CubemapSource =
  /** An image its **Import sidecar** imports as a cubemap. */
  { readonly form: 'file'; readonly path: string } | ImageCubemapSource;

export interface ImageCubemapSource {
  readonly form: 'image';
  /** The faces +X, -X, +Y, -Y, +Z and -Z. */
  readonly images: readonly SavedImage[];
}
