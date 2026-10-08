import { describe, expect, it } from 'vitest';
import { heading } from '../../../../parser/testing/parserKit';
import { EMPTY_AABB } from '../../../../godot/aabb';
import type { TscnNode } from '../../../../parser/types';
import { parseCPUParticles3D } from './parser';
import { useCPUParticles3DAabb } from './ownAabb';

function emitter(properties: Record<string, string>): TscnNode {
  const parsed = parseCPUParticles3D(heading('CPUParticles3D', { name: 'Sparks' }), properties);
  return {
    name: 'Sparks',
    type: 'CPUParticles3D',
    rawProperties: properties,
    children: [],
    properties: parsed,
  };
}

describe('useCPUParticles3DAabb', () => {
  it('takes the authored visibility_aabb', () => {
    const node = emitter({ mesh: 'SubResource("Box")', visibility_aabb: 'AABB(-1, -1, -1, 2, 2, 2)' });
    expect(useCPUParticles3DAabb(node)?.size).toEqual({ x: 2, y: 2, z: 2 });
  });

  it('leaves the box of a mesh over live particles unknown (error case)', () => {
    expect(useCPUParticles3DAabb(emitter({ mesh: 'SubResource("Box")' }))).toBeNull();
  });

  it('gives an emitter with no mesh the empty box (edge case)', () => {
    expect(useCPUParticles3DAabb(emitter({}))).toBe(EMPTY_AABB);
  });
});
