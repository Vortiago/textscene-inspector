import { describe, expect, it } from 'vitest';
import { resourceContentKey } from './resourceContentKey';

const box = (size: string) => ({ id: 'Box', type: 'BoxMesh', data: { size } });

describe('resourceContentKey', () => {
  it('gives two parses of the same resource one key', () => {
    expect(resourceContentKey(box('Vector3(1, 1, 1)'))).toBe(resourceContentKey(box('Vector3(1, 1, 1)')));
  });

  it('gives a changed property a new key', () => {
    expect(resourceContentKey(box('Vector3(1, 1, 1)'))).not.toBe(resourceContentKey(box('Vector3(2, 1, 1)')));
  });

  it('tells two types with the same properties apart (edge case)', () => {
    const sphere = { ...box('Vector3(1, 1, 1)'), type: 'SphereMesh' };
    expect(resourceContentKey(sphere)).not.toBe(resourceContentKey(box('Vector3(1, 1, 1)')));
  });
});
