import { withImageCanvas } from './withImageCanvas';

/**
 * Draw a decoded texture image (HTMLImageElement / ImageBitmap / canvas) to a
 * canvas and return a self-contained data URL. The decoded bitmap survives the
 * loader revoking its source blob URL, so this is stable where reusing
 * `image.src` is not. Returns undefined when the image isn't drawable — see
 * `withImageCanvas` for the cases.
 */
export function imageToDataUrl(image: unknown): string | undefined {
  return withImageCanvas(image, (ctx) => ctx.canvas.toDataURL());
}
