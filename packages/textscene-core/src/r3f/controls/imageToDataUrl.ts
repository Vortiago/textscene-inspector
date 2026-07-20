/**
 * Draw a decoded texture image (HTMLImageElement / ImageBitmap / canvas) to a
 * canvas and return a self-contained data URL. The decoded bitmap survives the
 * loader revoking its source blob URL, so this is stable where reusing
 * `image.src` is not. Returns undefined when the image isn't decoded yet, no
 * DOM/canvas is available (jsdom tests), or the draw is cross-origin tainted.
 */
export function imageToDataUrl(image: unknown): string | undefined {
  const img = image as
    | { width?: number; height?: number; naturalWidth?: number; naturalHeight?: number }
    | undefined;
  if (!img) return undefined;
  const w = img.naturalWidth || img.width || 0;
  const h = img.naturalHeight || img.height || 0;
  if (!w || !h) return undefined;
  const doc = globalThis.document;
  if (!doc) return undefined;
  try {
    const canvas = doc.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;
    ctx.drawImage(img as CanvasImageSource, 0, 0);
    return canvas.toDataURL();
  } catch {
    return undefined; // tainted canvas / unsupported image source
  }
}
