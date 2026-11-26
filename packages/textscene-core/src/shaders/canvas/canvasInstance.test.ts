import type * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import {
  FLAGS,
  instanceRecord,
  writeBatchRecords,
  writeBatchWorld,
  writeItemLights,
} from './canvasInstance.js';
import { quadBatchGeometry } from './canvasRect.js';

const IDENTITY = { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 };
const MOVED = { a: 0, b: 1, c: -1, d: 0, tx: 12, ty: 7 };

const batch = () =>
  quadBatchGeometry(
    [0, 1].map(() => instanceRecord({ transform: IDENTITY, finalModulate: { r: 1, g: 1, b: 1, a: 1 } }).bytes)
  );

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

describe('writeBatchRecords', () => {
  const WHITE = { r: 1, g: 1, b: 1, a: 1 };

  it('writes the floats and the words of each record it is asked for, and leaves the others', () => {
    const geometry = batch();

    writeBatchRecords(geometry, { transform: MOVED, finalModulate: WHITE }, 1, (record) => {
      record.words[FLAGS] = 7;
    });

    const words = (geometry.getAttribute('attrib_H') as THREE.InterleavedBufferAttribute).data;
    const floatLanes = (geometry.getAttribute('attrib_A') as THREE.InterleavedBufferAttribute).data.stride;
    expect([worldOfRecord(geometry, 0), worldOfRecord(geometry, 1)]).toEqual([
      [0, 1, -1, 0, 12, 7],
      [1, 0, 0, 1, 0, 0],
    ]);
    expect(words.array[FLAGS - floatLanes]).toBe(7);
  });

  it('uploads both buffers once for the batch', () => {
    const geometry = batch();
    const buffers = ['attrib_A', 'attrib_H'].map(
      (name) => (geometry.getAttribute(name) as THREE.InterleavedBufferAttribute).data
    );
    const versions = buffers.map(({ version }) => version);

    writeBatchRecords(geometry, { transform: IDENTITY, finalModulate: WHITE }, 2, () => {});

    expect(buffers.map(({ version }) => version)).toEqual(versions.map((version) => version + 1));
  });
});

describe('writeItemLights', () => {
  const WHITE = { r: 1, g: 1, b: 1, a: 1 };
  const LIGHTS = 28;

  it('adds the light count to the flags the command wrote', () => {
    const record = instanceRecord({ transform: IDENTITY, finalModulate: WHITE });
    record.words[FLAGS] = 1 << 4;
    writeItemLights(record, { flags: 3, lights: [0, 0, 0, 0] });
    expect(record.words[FLAGS]).toBe((1 << 4) | 3);
  });

  it('writes the four words of light indices after the flags', () => {
    const record = instanceRecord({ transform: IDENTITY, finalModulate: WHITE });
    writeItemLights(record, { flags: 2, lights: [0x0201, 0, 0, 0] });
    expect([...record.words.slice(LIGHTS, LIGHTS + 4)]).toEqual([0x0201, 0, 0, 0]);
  });
});
