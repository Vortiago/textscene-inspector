import { RGBA_BYTES } from './mipChain';

/** One level of an RGBA8 volume: slice after slice, each slice's rows from the top. */
export interface VolumeLevel {
  data: Uint8Array;
  width: number;
  height: number;
  depth: number;
}

const { fround } = Math;

/**
 * Levels below `base`, largest first, to 1 × 1 × 1 (`resource_importer_layered_texture.cpp:186-255`).
 *
 * @canonical A CPU mip chain of a 3D texture as Godot builds it
 */
export function volumeMipChain(base: VolumeLevel): VolumeLevel[] {
  const expectedBytes = base.width * base.height * base.depth * RGBA_BYTES;
  if (base.data.length !== expectedBytes)
    throw new Error(
      `expected ${expectedBytes} bytes for a ${base.width} × ${base.height} × ${base.depth} RGBA8 volume, ` +
        `got ${base.data.length}`
    );
  const levels: VolumeLevel[] = [];
  for (let parent = base; parent.width > 1 || parent.height > 1 || parent.depth > 1;) {
    parent = halved(parent);
    levels.push(parent);
  }
  return levels;
}

/** The texel and its neighbour along one side at a level's `index`, with the weight between them. */
interface Tap {
  near: number;
  far: number;
  weight: number;
}

/** `pos = index * side / halfSide + 0.5` in float, its truncation, and the neighbour clamped to the side. */
function tapOf(index: number, side: number, halfSide: number): Tap {
  const position = fround(fround(fround(index * side) / halfSide) + 0.5);
  const near = Math.trunc(position);
  return { near, far: near < side - 1 ? near + 1 : near, weight: fround(position - near) };
}

function halved(parent: VolumeLevel): VolumeLevel {
  const width = Math.max(1, parent.width >> 1);
  const height = Math.max(1, parent.height >> 1);
  const depth = Math.max(1, parent.depth >> 1);
  const data = new Uint8Array(width * height * depth * RGBA_BYTES);
  for (let z = 0; z < depth; z++) {
    const tz = tapOf(z, parent.depth, depth);
    for (let y = 0; y < height; y++) {
      const ty = tapOf(y, parent.height, height);
      for (let x = 0; x < width; x++) {
        const tx = tapOf(x, parent.width, width);
        const at = ((z * height + y) * width + x) * RGBA_BYTES;
        for (let channel = 0; channel < RGBA_BYTES; channel++)
          data[at + channel] = byteOf(trilinear(parent, tx, ty, tz, channel));
      }
    }
  }
  return { data, width, height, depth };
}

/** `get_pixel` of an RGBA8 texel's channel: its byte over 255 in float (`image.cpp:3444-3450`). */
function channelAt(
  { data, width, height }: VolumeLevel,
  x: number,
  y: number,
  z: number,
  channel: number
): number {
  return fround(data[((z * height + y) * width + x) * RGBA_BYTES + channel]! / 255);
}

/** `Color::lerp` in float (`color.h:110-117`, `math_funcs.h:339-341`). */
function lerp(from: number, to: number, weight: number): number {
  return fround(from + fround(fround(to - from) * weight));
}

/** The eight neighbours blended along x, then y, then z, as the importer does (`:226-236`). */
function trilinear(parent: VolumeLevel, tx: Tap, ty: Tap, tz: Tap, channel: number): number {
  const at = (x: number, y: number, z: number) => channelAt(parent, x, y, z, channel);
  const cx00 = lerp(at(tx.near, ty.near, tz.near), at(tx.far, ty.near, tz.near), tx.weight);
  const cx01 = lerp(at(tx.near, ty.near, tz.far), at(tx.far, ty.near, tz.far), tx.weight);
  const cx10 = lerp(at(tx.near, ty.far, tz.near), at(tx.far, ty.far, tz.near), tx.weight);
  const cx11 = lerp(at(tx.near, ty.far, tz.far), at(tx.far, ty.far, tz.far), tx.weight);
  return lerp(lerp(cx00, cx10, ty.weight), lerp(cx01, cx11, ty.weight), tz.weight);
}

/** `set_pixel` of an RGBA8 channel: the value times 255, clamped and truncated (`image.cpp:3576-3581`). */
function byteOf(value: number): number {
  return Math.trunc(Math.min(Math.max(value * 255, 0), 255));
}
