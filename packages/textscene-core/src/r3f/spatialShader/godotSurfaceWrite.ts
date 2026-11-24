import * as THREE from 'three';
import { withGodotAttributes } from '../../shaders/spatial/meshAttributes.js';
import { geometryPrimitive } from '../../resources/meshes/godotSurface.js';
import { perObject } from '../../utils/perObject.js';

/** Godot's attributes, written again when a held one changes, as a sprite's frame does. True when written. */
export function withGodotSurface(geometry: THREE.BufferGeometry): boolean {
  if (!hasSourcesChanged(geometry)) return false;
  withGodotAttributes(geometry, geometryPrimitive(geometry));
  const uv = geometry.getAttribute('uv');
  if (uv) geometry.setAttribute('uv_attrib', fromTopRow(uv));
  // Stamped after the write, which turns the index: a stamp before it sees a change on the next draw.
  writtenSources.set(geometry, sourceStamp(geometry));
  return true;
}

/** The previewer's attributes that Godot's are built from, as `withGodotAttributes` reads them. */
const SOURCE_ATTRIBUTES = [
  'position',
  'normal',
  'tangent',
  'color',
  'uv',
  'uv1',
  'custom0',
  'custom1',
  'custom2',
  'custom3',
  'skinIndex',
  'skinWeight',
];

/** Each geometry's index, source attributes and versions after its last write, by `withGodotSurface`. */
// eslint-disable-next-line no-restricted-syntax -- a record of the last write, compared on each draw, not a built value
const writtenSources = new WeakMap<THREE.BufferGeometry, unknown[]>();

/** Whether the index or a source attribute is new or changed since the last write. */
function hasSourcesChanged(geometry: THREE.BufferGeometry): boolean {
  const written = writtenSources.get(geometry);
  return !written || !isWrittenStamp(geometry, written);
}

/** Compared in place, with no array per draw: it runs before every draw of the surface. */
function isWrittenStamp(geometry: THREE.BufferGeometry, written: readonly unknown[]): boolean {
  for (let i = 0; i <= SOURCE_ATTRIBUTES.length; i++) {
    const source = sourceAt(geometry, i);
    if (written[i * 2] !== source || written[i * 2 + 1] !== (source ? versionOf(source) : -1)) return false;
  }
  return true;
}

function sourceStamp(geometry: THREE.BufferGeometry): unknown[] {
  const stamp: unknown[] = [];
  for (let i = 0; i <= SOURCE_ATTRIBUTES.length; i++) {
    const source = sourceAt(geometry, i);
    stamp.push(source, source ? versionOf(source) : -1);
  }
  return stamp;
}

function sourceAt(geometry: THREE.BufferGeometry, i: number) {
  return i === 0 ? geometry.index : geometry.getAttribute(SOURCE_ATTRIBUTES[i - 1]!);
}

function versionOf(source: THREE.BufferAttribute | THREE.InterleavedBufferAttribute): number {
  return source instanceof THREE.InterleavedBufferAttribute ? source.data.version : source.version;
}

type UvAttribute = THREE.BufferAttribute | THREE.InterleavedBufferAttribute;

/** Each first UV set flipped once while it is unchanged: every pass of a surface attaches it again. */
const fromTopRow = perObject(flippedCopy, { stamp: versionOf });

function flippedCopy(uv: UvAttribute): THREE.BufferAttribute {
  const flipped = new Float32Array(uv.count * 2);
  for (let i = 0; i < uv.count; i++) {
    flipped[i * 2] = uv.getX(i);
    flipped[i * 2 + 1] = 1 - uv.getY(i);
  }
  return new THREE.BufferAttribute(flipped, 2);
}

/** The last write of `geometry`'s attributes, a new value at each write, or undefined before the first. */
export function surfaceWriteOf(geometry: THREE.BufferGeometry): unknown {
  return writtenSources.get(geometry);
}
