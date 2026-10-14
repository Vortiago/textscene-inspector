/** The size and the exact RGBA8 bytes of a decoded texture image. */

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
 * RGBA8 pixels of an image, in its own row order: top row first for a decoded image, and bottom
 * row first for a typed-array `DataTexture` that uploads without `flipY` (`utils/reversedRows.ts`).
 */
export interface ImagePixels extends ImageSize {
  data: Uint8Array | Uint8ClampedArray;
}

/**
 * Reads the RGBA8 bytes of a texture image: `image.data` for a `DataTexture`, else a WebGL2
 * readback of the decoded image. `undefined` means no pixels were readable.
 */
export function readImagePixels(image: unknown): ImagePixels | undefined {
  const raw = (image as { data?: Uint8Array | Uint8ClampedArray } | null)?.data;
  if (raw) {
    const size = imageSize(image);
    return size ? { data: raw, ...size } : undefined;
  }
  const gl = readbackContext();
  return gl ? readPixelsThroughGl(gl, image) : undefined;
}

/**
 * Written only by `readbackContext`. One context serves every readback, and a lost one is
 * replaced on the next read. `null` once no context can exist (no DOM, or no WebGL2).
 */
let sharedReadbackContext: WebGL2RenderingContext | null | undefined;

function readbackContext(): WebGL2RenderingContext | null {
  if (sharedReadbackContext === null) return null;
  if (sharedReadbackContext && !sharedReadbackContext.isContextLost()) return sharedReadbackContext;
  const canvas = globalThis.document?.createElement('canvas');
  sharedReadbackContext = canvas?.getContext('webgl2') ?? null;
  return sharedReadbackContext;
}

/**
 * Uploads a decoded image to `gl` and reads its bytes back unpremultiplied and unconverted, top row
 * first, the bytes Godot's importer holds. WebGL, not a 2D canvas: the canvas stores premultiplied
 * alpha, which loses RGB at low alpha and all of it at alpha 0. `undefined`, never a throw, when
 * the image has no size or the context cannot hold it.
 */
export function readPixelsThroughGl(gl: WebGL2RenderingContext, image: unknown): ImagePixels | undefined {
  const size = imageSize(image);
  if (!size) return undefined;
  const texture = gl.createTexture();
  const framebuffer = gl.createFramebuffer();
  try {
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, image as TexImageSource);
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) return undefined;
    const data = new Uint8Array(size.width * size.height * 4);
    gl.readPixels(0, 0, size.width, size.height, gl.RGBA, gl.UNSIGNED_BYTE, data);
    if (gl.getError() !== gl.NO_ERROR) return undefined;
    return { data, ...size };
  } catch {
    // A cross-origin image throws on upload. Textures arrive as blob URLs of bytes the host
    // fetched, so a throw is not expected, but a caller degrades rather than breaks.
    return undefined;
  } finally {
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.deleteFramebuffer(framebuffer);
    gl.deleteTexture(texture);
  }
}
