/** Dimensions of a decoded image, however it reports them. */
export interface ImageSize {
  width: number;
  height: number;
}

/**
 * Read the size of a decoded texture image. `HTMLImageElement` reports
 * `naturalWidth`/`naturalHeight`; `ImageBitmap`, a canvas and a `DataTexture`'s
 * raw image report `width`/`height`. Returns `undefined` when there is nothing
 * decoded yet to measure.
 */
export function imageSize(image: unknown): ImageSize | undefined {
  const img = image as Partial<{
    width: number;
    height: number;
    naturalWidth: number;
    naturalHeight: number;
  }> | null;
  if (!img) return undefined;
  const width = img.naturalWidth || img.width || 0;
  const height = img.naturalHeight || img.height || 0;
  return width && height ? { width, height } : undefined;
}

/**
 * Draws a decoded image onto a 2D canvas of its size and hands the context to `read`. Returns
 * `undefined`, never throws, for an undecoded or sizeless image, no DOM or 2D context (node and
 * happy-dom), or a draw or read that throws on a cross-origin tainted canvas.
 */
export function withImageCanvas<T>(
  image: unknown,
  read: (ctx: CanvasRenderingContext2D, size: ImageSize) => T | undefined,
  contextOptions?: CanvasRenderingContext2DSettings
): T | undefined {
  const size = imageSize(image);
  if (!size) return undefined;
  const doc = globalThis.document;
  if (!doc) return undefined;
  try {
    const canvas = doc.createElement('canvas');
    canvas.width = size.width;
    canvas.height = size.height;
    const ctx = canvas.getContext('2d', contextOptions);
    if (!ctx) return undefined;
    ctx.drawImage(image as CanvasImageSource, 0, 0);
    return read(ctx, size);
  } catch {
    // A tainted canvas or an unsupported source. Textures arrive as blob URLs of bytes the host
    // fetched, so a taint is not expected, but a caller degrades rather than breaks.
    return undefined;
  }
}

/** RGBA8 pixels of a decoded image, first row = top row. */
export interface ImagePixels extends ImageSize {
  data: Uint8Array | Uint8ClampedArray;
}

/**
 * Reads the RGBA8 bytes of a texture image: `image.data` for a `DataTexture`, else `getImageData`
 * through `withImageCanvas`. `undefined` means no pixels were readable. Canvas 2D stores
 * premultiplied alpha, so the readback loses RGB precision at low alpha and all of it at alpha 0.
 */
export function readImagePixels(image: unknown): ImagePixels | undefined {
  const raw = (image as { data?: Uint8Array | Uint8ClampedArray } | null)?.data;
  if (raw) {
    const size = imageSize(image);
    return size ? { data: raw, ...size } : undefined;
  }
  return withImageCanvas(
    image,
    (ctx, { width, height }) => ({ data: ctx.getImageData(0, 0, width, height).data, width, height }),
    { willReadFrequently: true }
  );
}
