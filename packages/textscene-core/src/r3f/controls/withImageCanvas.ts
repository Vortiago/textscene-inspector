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
