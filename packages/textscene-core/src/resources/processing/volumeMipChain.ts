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
  const xTaps = tapsOf(width, parent.width);
  const yTaps = tapsOf(height, parent.height);
  const zTaps = tapsOf(depth, parent.depth);
  let at = 0;
  for (const tz of zTaps)
    for (const ty of yTaps)
      for (const tx of xTaps) {
        writeTrilinear(parent, tx, ty, tz, data, at);
        at += RGBA_BYTES;
      }
  return { data, width, height, depth };
}

/** The tap of each index of a level `halfSide` long, halved from `side`. */
function tapsOf(halfSide: number, side: number): Tap[] {
  return Array.from({ length: halfSide }, (_, index) => tapOf(index, side, halfSide));
}

/** `get_pixel` of an RGBA8 channel byte: the byte over 255 in float (`image.cpp:3444-3450`). */
function channelValue(byte: number): number {
  return fround(byte / 255);
}

/** `Color::lerp` in float (`color.h:110-117`, `math_funcs.h:339-341`). */
function lerp(from: number, to: number, weight: number): number {
  return fround(from + fround(fround(to - from) * weight));
}

/** The byte offset of a level's texel. */
function offsetOf({ width, height }: VolumeLevel, x: number, y: number, z: number): number {
  return ((z * height + y) * width + x) * RGBA_BYTES;
}

/** A channel blended between the texels at byte offsets `near` and `far` by `weight`. */
function blendedChannel(data: Uint8Array, near: number, far: number, weight: number): number {
  return lerp(channelValue(data[near]!), channelValue(data[far]!), weight);
}

/** Writes the eight neighbours blended along x, then y, then z, as the importer does (`:226-236`). */
function writeTrilinear(parent: VolumeLevel, tx: Tap, ty: Tap, tz: Tap, out: Uint8Array, at: number): void {
  const { data } = parent;
  const n00 = offsetOf(parent, tx.near, ty.near, tz.near);
  const f00 = offsetOf(parent, tx.far, ty.near, tz.near);
  const n01 = offsetOf(parent, tx.near, ty.near, tz.far);
  const f01 = offsetOf(parent, tx.far, ty.near, tz.far);
  const n10 = offsetOf(parent, tx.near, ty.far, tz.near);
  const f10 = offsetOf(parent, tx.far, ty.far, tz.near);
  const n11 = offsetOf(parent, tx.near, ty.far, tz.far);
  const f11 = offsetOf(parent, tx.far, ty.far, tz.far);
  for (let channel = 0; channel < RGBA_BYTES; channel++) {
    const cx00 = blendedChannel(data, n00 + channel, f00 + channel, tx.weight);
    const cx01 = blendedChannel(data, n01 + channel, f01 + channel, tx.weight);
    const cx10 = blendedChannel(data, n10 + channel, f10 + channel, tx.weight);
    const cx11 = blendedChannel(data, n11 + channel, f11 + channel, tx.weight);
    out[at + channel] = byteOf(lerp(lerp(cx00, cx10, ty.weight), lerp(cx01, cx11, ty.weight), tz.weight));
  }
}

/** `set_pixel` of an RGBA8 channel: the value times 255, clamped and truncated (`image.cpp:3576-3581`). */
function byteOf(value: number): number {
  return Math.trunc(Math.min(Math.max(value * 255, 0), 255));
}
