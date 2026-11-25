import type * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { instanceRecord, writeBatchRecord, writeBatchWorld } from './canvasInstance.js';
import { quadBatchGeometry } from './canvasRect.js';

const IDENTITY = { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 };
const MOVED = { a: 0, b: 1, c: -1, d: 0, tx: 12, ty: 7 };

const batch = () =>
  quadBatchGeometry([0, 1].map(() => instanceRecord({ transform: IDENTITY, finalModulate: { r: 1, g: 1, b: 1, a: 1 } }).bytes));

const worldOfRecord = (geometry: THREE.InstancedBufferGeometry, index: number) => {
  const buffer = (geometry.getAttribute('attrib_A') as THREE.InterleavedBufferAttribute).data;
  return [...buffer.array.slice(index * buffer.stride, index * buffer.stride + 6)];
};

describe('writeBatchWorld', () => {
  it("writes the item transform as one record's world, axes then origin", () => {
    const geometry = batch();

    writeBatchWorld(geometry, 1, MOVED);

    expect([worldOfRecord(geometry, 0), worldOfRecord(geometry, 1)]).toEqual([
      [1, 0, 0, 1, 0, 0],
      [0, 1, -1, 0, 12, 7],
    ]);
  });

  it('uploads the floats again when the world changes', () => {
    const geometry = batch();
    const buffer = (geometry.getAttribute('attrib_A') as THREE.InterleavedBufferAttribute).data;
    const version = buffer.version;

    writeBatchWorld(geometry, 0, MOVED);

    expect(buffer.version).toBe(version + 1);
  });

  it('uploads nothing for the world the record holds', () => {
    const geometry = batch();
    const buffer = (geometry.getAttribute('attrib_A') as THREE.InterleavedBufferAttribute).data;
    const version = buffer.version;

    writeBatchWorld(geometry, 0, IDENTITY);

    expect(buffer.version).toBe(version);
  });
});

describe('writeBatchRecord', () => {
  it('writes the floats and the words of one record, and leaves the others', () => {
    const geometry = batch();
    const record = instanceRecord({ transform: MOVED, finalModulate: { r: 1, g: 1, b: 1, a: 1 } }).bytes;

    writeBatchRecord(geometry, 1, record);

    expect([worldOfRecord(geometry, 0), worldOfRecord(geometry, 1)]).toEqual([
      [1, 0, 0, 1, 0, 0],
      [0, 1, -1, 0, 12, 7],
    ]);
  });

  it('uploads both buffers again', () => {
    const geometry = batch();
    const buffers = ['attrib_A', 'attrib_H'].map(
      (name) => (geometry.getAttribute(name) as THREE.InterleavedBufferAttribute).data
    );
    const versions = buffers.map(({ version }) => version);

    writeBatchRecord(geometry, 0, instanceRecord({ transform: IDENTITY, finalModulate: { r: 1, g: 1, b: 1, a: 1 } }).bytes);

    expect(buffers.map(({ version }) => version)).toEqual(versions.map((version) => version + 1));
  });
});
