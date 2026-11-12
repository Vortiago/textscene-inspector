import { describe, expect, it } from 'vitest';
import { staticSnapshot } from '../../reading/staticSnapshot.testkit';
import { nodeReference } from '../../reading/scopedReference';
import { subResource } from '../../../testing/subResource';
import { MULTI_MESH } from './kind';

function readOnly(data: Record<string, string>, type = 'MultiMesh') {
  const scene = { internalResources: [subResource(type, 'only', data)], externalResources: [] };
  return staticSnapshot({}).read(nodeReference('SubResource("only")', scene), MULTI_MESH);
}

describe('MULTI_MESH', () => {
  it('keeps the mesh slot with the tables of the MultiMesh', () => {
    const read = readOnly({ instance_count: '1', mesh: 'SubResource("box")' });
    expect(read.value?.meshReference.ref).toBe('SubResource("box")');
  });

  it('declines a MultiMesh with an unreadable packed array', () => {
    const read = readOnly({ instance_count: '1', buffer: 'PackedFloat32Array(1, x)' });
    expect(read).toMatchObject({ status: 'unavailable', reason: 'undecodable' });
  });

  it('answers wrong-type for another class', () => {
    expect(readOnly({}, 'BoxMesh')).toMatchObject({ status: 'unavailable', reason: 'wrong-type' });
  });
});
