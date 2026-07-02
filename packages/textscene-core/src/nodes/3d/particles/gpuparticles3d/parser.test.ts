import { describe, expect, it } from 'vitest';
import { heading } from '../../../../parser/testing/parserKit';
import { parseNode3D } from '../../../base/node3d/parser';

describe('parseNode3D (gpuparticles3d)', () => {
  it('parses name, parent, and transform (happy path)', () => {
    const result = parseNode3D(
      heading('GPUParticles3D', { name: 'MyGPUParticles', parent: '.' }),
      { transform: 'Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 3, 4, 5)' }
    );
    expect(result.name).toBe('MyGPUParticles');
    expect(result.parent).toBe('.');
    expect(result.transform?.origin).toEqual({ x: 3, y: 4, z: 5 });
  });

  it('falls back to identity on malformed transform', () => {
    const result = parseNode3D(heading('GPUParticles3D', { name: 'BadParticle' }), {
      transform: 'Transform3D(bad)',
    });
    expect(result.transform?.basis_x).toEqual({ x: 1, y: 0, z: 0 });
    expect(result.transform?.origin).toEqual({ x: 0, y: 0, z: 0 });
  });

  it('ignores particle-specific properties not parsed by parseNode3D', () => {
    const result = parseNode3D(
      heading('GPUParticles3D', { name: 'PartialParticle' }),
      { amount: '100', process_material: 'SubResource("mat")' }
    );
    expect(result.name).toBe('PartialParticle');
    expect(result.transform).toBeUndefined();
  });
});
