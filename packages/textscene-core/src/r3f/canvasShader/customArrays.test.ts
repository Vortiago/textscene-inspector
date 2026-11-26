import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { attributesGeometry } from '../../shaders/canvas/canvasAttributes';
import { canvasSurfaceGeometry } from '../canvasMesh/canvasSurface';
import { meshCommands } from './canvasCommands';

/** A triangle in Godot's frame: three points, so a custom array of four lanes holds 12 floats. */
const TRIANGLE = { positions: Float32Array.from([0, 0, 8, 0, 0, 4]), indices: [0, 1, 2] };

const counting = (length: number, from = 1) => Float32Array.from({ length }, (_, i) => i + from);

/** What the draw binds for CUSTOM0: its lanes, nothing, or the refusal. */
type Bound =
  { readonly lanes: number[] | null; readonly sharesSource?: boolean } | { readonly throws: string };

/** The triangle's CUSTOM0 attribute, or none, through the commands and the attributes of a draw. */
function boundCustom0(
  custom0: THREE.BufferAttribute | THREE.InterleavedBufferAttribute | null,
  read: boolean
) {
  const geometry = canvasSurfaceGeometry(TRIANGLE);
  if (custom0) geometry.setAttribute('custom0', custom0);
  const [command] = meshCommands([geometry]);
  if (command?.kind !== 'mesh') throw new Error(`expected a mesh command, got ${command?.kind}`);
  const drawn = attributesGeometry(command.arrays, { customsRead: read ? [0] : [], emulatesPoints: false });
  return drawn.getAttribute('custom0_attrib') ?? null;
}

function bound(
  custom0: () => THREE.BufferAttribute | THREE.InterleavedBufferAttribute | null,
  read: boolean
): Bound {
  const source = custom0();
  let attribute: THREE.BufferAttribute | THREE.InterleavedBufferAttribute | null;
  try {
    attribute = boundCustom0(source, read);
  } catch (error) {
    return { throws: (error as Error).message };
  }
  if (!attribute) return { lanes: null };
  return { lanes: [...attribute.array], sharesSource: source?.array === attribute.array };
}

const pool16 = () => counting(16, 0);

describe('a custom array through a canvas mesh draw', () => {
  it.each<[string, () => THREE.BufferAttribute | THREE.InterleavedBufferAttribute | null, boolean, Bound]>([
    [
      'one lane, read: a missing lane reads 0 and a missing alpha 1',
      () => new THREE.BufferAttribute(counting(3), 1),
      true,
      { lanes: [1, 0, 0, 1, 2, 0, 0, 1, 3, 0, 0, 1], sharesSource: false },
    ],
    [
      'two lanes, read',
      () => new THREE.BufferAttribute(counting(6), 2),
      true,
      { lanes: [1, 2, 0, 1, 3, 4, 0, 1, 5, 6, 0, 1], sharesSource: false },
    ],
    [
      'three lanes, read',
      () => new THREE.BufferAttribute(counting(9), 3),
      true,
      { lanes: [1, 2, 3, 1, 4, 5, 6, 1, 7, 8, 9, 1], sharesSource: false },
    ],
    [
      'four lanes in a buffer of its own, read: shared, as the surface loader writes it',
      () => new THREE.BufferAttribute(counting(12), 4),
      true,
      { lanes: [...counting(12)], sharesSource: true },
    ],
    [
      'four lanes in a view of exactly its points over a larger pool, read: shared',
      () => new THREE.BufferAttribute(pool16().subarray(4), 4),
      true,
      { lanes: [...counting(12, 4)], sharesSource: true },
    ],
    [
      'four lanes over a larger pool, read: copied, the pool past its points left out',
      () => Object.assign(new THREE.BufferAttribute(pool16(), 4), { count: 3 }),
      true,
      { lanes: [...counting(12, 0)], sharesSource: false },
    ],
    [
      'four lanes interleaved, read: copied by its lanes',
      () => new THREE.InterleavedBufferAttribute(new THREE.InterleavedBuffer(counting(15, 0), 5), 4, 1),
      true,
      { lanes: [1, 2, 3, 4, 6, 7, 8, 9, 11, 12, 13, 14], sharesSource: false },
    ],
    [
      'of another length than the points, read: refused with the lanes found',
      () => new THREE.BufferAttribute(counting(8), 4),
      true,
      { throws: 'expected 12 lanes in CUSTOM0, got 8' },
    ],
    [
      'missing, read: zero, as mesh_storage.cpp:120-131 fills it',
      () => null,
      true,
      { lanes: Array(12).fill(0), sharesSource: false },
    ],
    [
      'one lane, not read: not bound',
      () => new THREE.BufferAttribute(counting(3), 1),
      false,
      { lanes: null },
    ],
    [
      'four lanes, not read: not bound',
      () => new THREE.BufferAttribute(counting(12), 4),
      false,
      { lanes: null },
    ],
    [
      'of another length than the points, not read: the mesh draws without it',
      () => new THREE.BufferAttribute(counting(8), 4),
      false,
      { lanes: null },
    ],
  ])('%s', (_, custom0, read, expected) => {
    expect(bound(custom0, read)).toEqual(expected);
  });
});
