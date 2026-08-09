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
 * Draw a decoded image (HTMLImageElement / ImageBitmap / canvas) onto a 2D
 * canvas of its own size and hand the context to `read`, which extracts
 * whatever it needs — pixel bytes, a data URL — before the canvas is dropped.
 *
 * This owns the one policy both extractions share: when is an image drawable,
 * and how does the attempt degrade? Returns `undefined` for an image that is
 * not decoded or has no size, when there is no DOM or no 2D context (node and
 * happy-dom test environments), and when the draw or the read throws because
 * the canvas is cross-origin tainted. Callers get `undefined` and fall back;
 * nothing throws out of here.
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
    return undefined; // tainted canvas / unsupported image source
  }
}

/** RGBA8 pixels of a decoded image, first row = top row. */
export interface ImagePixels extends ImageSize {
  data: Uint8Array | Uint8ClampedArray;
}

/**
 * Read a texture image's RGBA8 bytes.
 *
 * A `DataTexture` already carries them (`image.data`). Everything the resource
 * pipeline loads is decoded by `THREE.TextureLoader` into an `HTMLImageElement`
 * with no `.data`, so those go through `withImageCanvas` and come back via
 * `getImageData`. `undefined` means no pixels were readable (undecoded image,
 * no DOM, no 2D context, tainted canvas); textures reach both hosts as blob
 * URLs built from bytes the host already fetched, so a taint is not expected,
 * but every caller must degrade rather than break.
 *
 * Canvas 2D stores premultiplied alpha, so the readback loses R/G/B precision
 * where alpha is low and loses them outright where alpha is 0. What that costs
 * is the CALLER's to weigh — see each caller's own doc.
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
