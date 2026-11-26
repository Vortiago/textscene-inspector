import * as THREE from 'three';
import { imageSize, readImagePixels } from '../../resources/formats/image/imagePixels.js';
import { isLiveTarget, liveTargetPixels } from '../liveTargets.js';
import { perObject } from '../../utils/perObject.js';
import { isBottomUp, reverseRowsInPlace, reversedRows } from '../../utils/reversedRows.js';

/** Pixels as Godot's image holds them: RGBA8 sRGB bytes, the top row first. */
export interface GodotImage {
  width: number;
  height: number;
  data: Uint8Array | Uint8ClampedArray;
}

/**
 * Each texture's last read, so an atlas rebuild reads again only a texture whose pixels changed:
 * a read of a decoded image is a GPU readback. Undefined when the pixels cannot be read, as before
 * the image decodes.
 */
const godotImage = perObject(readGodotImage, { stamp: ({ version }) => version });

/** A fresh read of `texture`'s pixels, which no cache keeps. */
export function readGodotImage(texture: THREE.Texture): GodotImage | undefined {
  if (!readsAsBytes(texture)) return undefined;
  const pixels = readImagePixels(texture.image);
  if (!pixels) return undefined;
  return isBottomUp(texture) ? topRowFirst(pixels) : pixels;
}

/** An image as Godot pads it, in its own format (`tile_set.cpp:5637`): half floats stay half floats. */
export interface OwnFormatImage {
  width: number;
  height: number;
  data: GodotImage['data'] | Uint16Array;
}

/** A fresh read of `texture`'s pixels in their own format, top row first. Undefined: unreadable. */
export function readOwnFormatImage(texture: THREE.Texture): OwnFormatImage | undefined {
  if (!readsAsBytes(texture)) return undefined;
  const { data } = (texture.image ?? {}) as { data?: unknown };
  if (texture.type !== THREE.HalfFloatType || !(data instanceof Uint16Array)) return readGodotImage(texture);
  const size = imageSize(texture.image);
  if (!size) return undefined;
  return isBottomUp(texture) ? topRowFirst({ ...size, data }) : { ...size, data };
}

/**
 * A live target's pixels now, read at each call, as Godot copies the target's texels into an atlas
 * at each rebuild (`texture_storage.cpp:3216`). Its version never moves, so a cached read would
 * keep the first frame.
 */
function readLiveTargetImage(texture: THREE.Texture): GodotImage | undefined {
  if (!readsAsBytes(texture)) return undefined;
  const pixels = liveTargetPixels(texture);
  // In place: the readback is this call's own buffer.
  if (pixels) reverseRowsInPlace(pixels.data, pixels.width, pixels.height);
  return pixels;
}

function topRowFirst<Image extends OwnFormatImage>(image: Image): Image {
  return { ...image, data: reversedRows(image.data, image.width, image.height) };
}

/**
 * Whether `readImagePixels` gives `texture` as RGBA8 bytes: its own bytes, or half floats it clamps
 * to bytes. A float or a one- or two-channel array would copy into the atlas with the wrong stride.
 */
function readsAsBytes({ format, type }: THREE.Texture): boolean {
  return format === THREE.RGBAFormat && (type === THREE.UnsignedByteType || type === THREE.HalfFloatType);
}

/** The textures of `textures` whose pixels can be read, each with its image, in the order given. */
export function readableTextures(
  textures: readonly THREE.Texture[]
): { texture: THREE.Texture; image: GodotImage }[] {
  return textures.flatMap((texture) => {
    const image = isLiveTarget(texture) ? readLiveTargetImage(texture) : godotImage(texture);
    return image ? [{ texture, image }] : [];
  });
}
