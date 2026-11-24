import { byteOf, channelOf } from '../../godot/project/image';
import { lerpf } from '../../godot/math/math';
import { mipSize, RGBA_BYTES, type MipLevel } from './mipChain';

/** One level of an RGBA8 volume: slice after slice, each slice's rows from the top. */
export interface VolumeLevel extends MipLevel {
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
  const width = mipSize(parent.width, 1);
  const height = mipSize(parent.height, 1);
  const depth = mipSize(parent.depth, 1);
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

/** The byte offset of a level's texel. */
function offsetOf({ width, height }: VolumeLevel, x: number, y: number, z: number): number {
  return ((z * height + y) * width + x) * RGBA_BYTES;
}

/** `channelOf` of each byte, read 32 times for each texel of a level. */
const CHANNEL_OF_BYTE = Float32Array.from({ length: 256 }, (_, byte) => channelOf(byte));

/** A channel blended between the texels at byte offsets `near` and `far` by `weight`. */
function blendedChannel(data: Uint8Array, near: number, far: number, weight: number): number {
  return lerpf(CHANNEL_OF_BYTE[data[near]!]!, CHANNEL_OF_BYTE[data[far]!]!, weight);
}

/** Writes the eight neighbours blended along x, then y, then z, as the importer does (`:226-236`). */
function writeTrilinear(parent: VolumeLevel, tx: Tap, ty: Tap, tz: Tap, out: Uint8Array, at: number): void {
  const { data } = parent;
  const n00 = offsetOf(parent, tx.near, ty.near, tz.near);
  const n01 = offsetOf(parent, tx.near, ty.near, tz.far);
  const n10 = offsetOf(parent, tx.near, ty.far, tz.near);
  const n11 = offsetOf(parent, tx.near, ty.far, tz.far);
  const toFar = (tx.far - tx.near) * RGBA_BYTES;
  for (let channel = 0; channel < RGBA_BYTES; channel++) {
    const cx00 = blendedChannel(data, n00 + channel, n00 + toFar + channel, tx.weight);
    const cx01 = blendedChannel(data, n01 + channel, n01 + toFar + channel, tx.weight);
    const cx10 = blendedChannel(data, n10 + channel, n10 + toFar + channel, tx.weight);
    const cx11 = blendedChannel(data, n11 + channel, n11 + toFar + channel, tx.weight);
    out[at + channel] = byteOf(lerpf(lerpf(cx00, cx10, ty.weight), lerpf(cx01, cx11, ty.weight), tz.weight));
  }
}
