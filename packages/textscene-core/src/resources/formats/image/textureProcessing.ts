/** The image slice's texture decode, which `processors/createTextureProcessor.ts` calls. */

import * as THREE from 'three';
import { imageSize, readImagePixels, type ImagePixels } from './imagePixels';
import { fixAlphaEdges } from '../../processing/fixAlphaEdges';
import {
  invertGreen,
  invertGreyscaleGreen,
  keepRedGreen,
  premultiplyAlpha,
} from '../../processing/importTexelPasses';
import { copySampling } from '../../textures/copySampling';
import { dropMipChain } from '../../textures/godotTextureFilter';
import { recordGodotFormat } from '../../textures/sourceColorSpace';
import { IMAGE_EXTENSIONS, SVG_MIME_TYPE, imageMimeType } from './extensions';
import { fileExtension } from '../../fileExtension';
import type { ImageSourceFormat } from '../../../godot/import/imageSourceFormat.js';
import {
  hasTranslucentTexel,
  holdsRedGreenOnly,
  textureImportFormat,
  type TextureImportOptions,
} from '../../../godot/import/textureImport.js';

/** The MIME type of the image file `path` names, the generic binary type for no image format. */
export function getMimeType(path: string): string {
  return imageMimeType(path) ?? 'application/octet-stream';
}

export function isTexturePath(path: string): boolean {
  const extension = fileExtension(path);
  return extension !== null && IMAGE_EXTENSIONS.includes(extension);
}

/**
 * How Godot imports an image file: the format its loader reads it in, null when no header names
 * one, and the options of its import sidecar.
 */
export interface ImageImport {
  source: ImageSourceFormat | null;
  options: TextureImportOptions;
}

/** A pass over RGBA8 bytes, top row first, that returns whether any byte changed. */
type TexelPass = (data: Uint8Array, width: number, height: number) => boolean;

/** A texture after the texel passes, and its RGBA8 bytes when a pass read them. */
interface PassedTexture {
  texture: THREE.Texture;
  /** Undefined when no pass ran or the pixels could not be read. */
  texels: Uint8Array | undefined;
}

/**
 * Create a THREE.Texture from image bytes as Godot's texture importer builds it: an SVG rasterised
 * at its import scale, then the import of the decoded image.
 */
export async function createTextureFromBuffer(
  data: ArrayBuffer,
  mimeType: string,
  imported: ImageImport,
  manager?: THREE.LoadingManager
): Promise<THREE.Texture> {
  const decoded = await decodeImage(data, mimeType, manager);
  const texture = mimeType === SVG_MIME_TYPE ? rasterisedAt(decoded, imported.options.svgScale) : decoded;
  texture.colorSpace = THREE.SRGBColorSpace;
  // Wrapping stays at three's clamp-to-edge default. One entry is cached
  // per path and shared, and Godot gives it two opposite defaults:
  // `BaseMaterial3D` tiles (`FLAG_USE_TEXTURE_REPEAT`) and a `CanvasItem`
  // clamps. Each consumer states its own at bind time (ADR-0044).
  return importDecodedImage(texture, imported);
}

/**
 * A decoded image as Godot's texture importer stores it: the texel passes its sidecar asks for, its
 * mip chain, and the format a colour slot reads it through. The caller hands over `texture`: it
 * gets it back when no pass changes a byte, and it is disposed otherwise.
 */
export function importDecodedImage(texture: THREE.Texture, imported: ImageImport): THREE.Texture {
  const passed = applyTexelPasses(texture, texelPassesFor(imported));
  if (!imported.options.mipmaps) dropMipChain(passed.texture);
  if (imported.source === null) return passed.texture;
  const format = textureImportFormat(imported.source, imported.options, () => isTranslucent(passed));
  return recordGodotFormat(passed.texture, format);
}

/**
 * Whether a texel uses alpha, read from the bytes the passes left, or read back when no pass read
 * them. A texture whose pixels cannot be read counts as translucent.
 */
function isTranslucent({ texture, texels }: PassedTexture): boolean {
  const bytes = texels ?? readImagePixels(texture.image)?.data;
  return bytes === undefined || hasTranslucentTexel(bytes);
}

/**
 * The passes in the importer's order (`resource_importer_texture.cpp:861-874`), then the channels a
 * compression to RGTC drops. The alpha-border pass and the premultiply return on any format but
 * RGBA8 (`core/io/image.cpp:4225`, `:4247`). A source no header names reads as RGBA8.
 */
function texelPassesFor({ source, options }: ImageImport): TexelPass[] {
  const isRgba8 = source === null || source === 'RGBA8';
  const isGreyscale = source === 'Lum8' || source === 'LumAlpha8';
  const passes: TexelPass[] = [];
  if (options.fixAlphaBorder && isRgba8) passes.push(fixAlphaEdges);
  if (options.premultAlpha && isRgba8) passes.push(premultiplyAlpha);
  if (options.invertNormalY) passes.push(isGreyscale ? invertGreyscaleGreen : invertGreen);
  if (holdsRedGreenOnly(options)) passes.push(keepRedGreen);
  return passes;
}

/**
 * An SVG drawn at `scale` times its own size, rounded, as Godot's SVG loader rasterises it
 * (`modules/svg/image_loader_svg.cpp:91-103`). The browser draws the vector at the canvas size.
 * The decoded image at scale 1, or when no 2D canvas is available.
 */
function rasterisedAt(texture: THREE.Texture, scale: number): THREE.Texture {
  const size = imageSize(texture.image);
  if (scale === 1 || !size) return texture;
  const canvas = globalThis.document?.createElement('canvas');
  const context = canvas?.getContext('2d');
  if (!canvas || !context) return texture;
  canvas.width = Math.min(SVG_MAX_DIMENSION, Math.max(1, Math.round(size.width * scale)));
  canvas.height = Math.min(SVG_MAX_DIMENSION, Math.max(1, Math.round(size.height * scale)));
  context.drawImage(texture.image as CanvasImageSource, 0, 0, canvas.width, canvas.height);
  const rasterised = copySampling(new THREE.CanvasTexture(canvas), texture);
  rasterised.flipY = texture.flipY;
  texture.dispose();
  return rasterised;
}

/** `max_dimension` in `image_loader_svg.cpp:94`. */
const SVG_MAX_DIMENSION = 16384;

/**
 * The RGBA8 pixels of image bytes, top row first, as Godot's layered importer reads its source:
 * with no alpha-border pass, which only the 2D importer runs.
 */
export async function decodeImagePixels(
  data: ArrayBuffer,
  mimeType: string,
  manager?: THREE.LoadingManager
): Promise<ImagePixels> {
  const texture = await decodeImage(data, mimeType, manager);
  const pixels = readImagePixels(texture.image);
  texture.dispose();
  if (!pixels) throw new Error(`Failed to read the pixels of a decoded ${mimeType} image`);
  return pixels;
}

/** Decodes image bytes through a blob URL, which it revokes. */
async function decodeImage(
  data: ArrayBuffer,
  mimeType: string,
  manager?: THREE.LoadingManager
): Promise<THREE.Texture> {
  const blob = new Blob([data], { type: mimeType });
  const blobUrl = URL.createObjectURL(blob);
  try {
    const loader = new THREE.TextureLoader(manager);
    return await new Promise<THREE.Texture>((resolve, reject) => {
      loader.load(blobUrl, resolve, undefined, () => {
        reject(new Error('Failed to decode texture'));
      });
    });
  } finally {
    URL.revokeObjectURL(blobUrl);
  }
}

/**
 * Runs `passes` on a decoded texture's bytes. It returns the same texture when no pass changes a
 * byte, and otherwise a `DataTexture` of the rewritten bytes, since a decoded image cannot be
 * edited in place. It then disposes the decoded texture, which the caller hands over.
 */
function applyTexelPasses(texture: THREE.Texture, passes: TexelPass[]): PassedTexture {
  if (passes.length === 0) return { texture, texels: undefined };
  const pixels = readImagePixels(texture.image);
  if (!pixels) return { texture, texels: undefined };

  // A DataTexture's own buffer is a cached resource that other consumers share, so the passes
  // edit a copy of it. A readback is already a fresh buffer.
  const isOwnBuffer = pixels.data === (texture.image as { data?: unknown }).data;
  const data =
    isOwnBuffer || !(pixels.data instanceof Uint8Array) ? new Uint8Array(pixels.data) : pixels.data;
  let changed = false;
  for (const pass of passes) changed = pass(data, pixels.width, pixels.height) || changed;
  if (!changed) return { texture, texels: data };

  const rewritten = copySampling(
    new THREE.DataTexture(data, pixels.width, pixels.height, THREE.RGBAFormat),
    texture
  );
  rewritten.needsUpdate = true;
  rewritten.colorSpace = texture.colorSpace;
  // The readback is top-row-first, the same orientation the decoded image
  // uploads in, so the loaded texture's own flip decides which way is up.
  rewritten.flipY = texture.flipY;
  texture.dispose();
  return { texture: rewritten, texels: data };
}
