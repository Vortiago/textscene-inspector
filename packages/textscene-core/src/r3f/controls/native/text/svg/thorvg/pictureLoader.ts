/**
 * ThorVG's `LoaderMgr::loader` for data in memory (`tvgLoader.cpp:372-420`) as Godot builds it:
 * the loader the media type names, then every loader in turn. Godot links the SVG and PNG loaders,
 * and JPEG and WebP where their modules are on.
 *
 * Portions ported from ThorVG (MIT License). Copyright (c) 2020 - 2024 the ThorVG project.
 */
import { decodePngStraight, type ZlibInflate } from '../../strike/png';
import type { ImageLoader } from './paint';
import { openSvgLoader } from './svgPictureLoader';

/** What a loader of compressed images needs. */
export interface PictureDecoders {
  readonly inflate: ZlibInflate;
}

type LoaderType = 'png' | 'svg';

/** `FileType` order, in which a loader is tried when the media type names none that opens. */
const LOADER_ORDER: readonly LoaderType[] = ['png', 'svg'];

/** `_convert`: the loader a media type names. */
function loaderOfMimeType(mimeType: string): LoaderType | null {
  if (mimeType === 'svg' || mimeType === 'svg+xml') return 'svg';
  if (mimeType === 'png') return 'png';
  return null;
}

/** The loader of `bytes`, or null where none opens and reads them. */
export function openPicture(
  bytes: Uint8Array,
  mimeType: string,
  decoders: PictureDecoders
): ImageLoader | null {
  const named = loaderOfMimeType(mimeType);
  if (named) {
    const loader = openWith(named, bytes, decoders);
    if (loader) return loader;
  }
  for (const type of LOADER_ORDER) {
    const loader = openWith(type, bytes, decoders);
    if (loader) return loader;
  }
  return null;
}

function openWith(type: LoaderType, bytes: Uint8Array, decoders: PictureDecoders): ImageLoader | null {
  if (type === 'svg')
    return openSvgLoader(new TextDecoder().decode(bytes), (data, mime) => openPicture(data, mime, decoders));
  return openPngLoader(bytes, decoders.inflate);
}

/** `PngLoader`: libpng's straight BGRA, as ARGB words in a little-endian buffer. */
function openPngLoader(bytes: Uint8Array, inflate: ZlibInflate): ImageLoader | null {
  const image = decodePngStraight(bytes, inflate);
  if (!image || image.width === 0 || image.height === 0) return null;
  const data = new Uint32Array(image.width * image.height);
  const { rgba } = image;
  for (let i = 0; i < data.length; i++) {
    const at = i * 4;
    data[i] = ((rgba[at + 3]! << 24) | (rgba[at]! << 16) | (rgba[at + 1]! << 8) | rgba[at + 2]!) >>> 0;
  }
  const surface = { data, w: image.width, h: image.height, stride: image.width, isPremultiplied: false };
  return {
    w: image.width,
    h: image.height,
    paint: () => null,
    bitmap: () => surface,
    resize: () => undefined,
  };
}
