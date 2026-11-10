/**
 * An Ogg Theora file as the **ParsedResource** Godot's `VideoStreamTheora` would be (ADR-0031):
 * a stream resource that states its picture size, which a `VideoStreamPlayer` takes as its texture
 * size. Nothing here decodes a frame.
 */

import type { ParsedResource } from '../../../parser/parsedResource';
import type { Vector2 } from '../../../godot/math/vector';
import { readTheoraPictureSize } from './pictureSize';

const VIDEO_STREAM_THEORA_TYPE = 'VideoStreamTheora';

/** A file Godot finds no Theora stream in leaves both keys unset. */
export function parseTheoraVideo(bytes: ArrayBuffer): ParsedResource {
  const size = readTheoraPictureSize(new Uint8Array(bytes));
  return {
    resourceType: VIDEO_STREAM_THEORA_TYPE,
    properties: size ? { picture_width: String(size.x), picture_height: String(size.y) } : {},
    extResources: [],
    subResources: [],
  };
}

/** The picture size `parseTheoraVideo` read, or null for any other resource or a file with no Theora stream. */
export function theoraPictureSizeOf(parsed: ParsedResource): Vector2 | null {
  if (parsed.resourceType !== VIDEO_STREAM_THEORA_TYPE) return null;
  const { picture_width: width, picture_height: height } = parsed.properties;
  return width === undefined || height === undefined ? null : { x: Number(width), y: Number(height) };
}
