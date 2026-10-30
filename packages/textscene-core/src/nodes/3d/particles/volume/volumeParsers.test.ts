import { describe, expect, it } from 'vitest';
import { heading } from '../../../../parser/testing/parserKit';
import { parseBoxVolume } from './parseBoxVolume';
import { parseSdfVolume } from './parseSdfVolume';
import { parseSphereVolume } from './parseSphereVolume';

const node = (type: string) => heading(type, { name: 'Volume' });

describe('parseBoxVolume', () => {
  it('reads an empty node as Godot constructs it: a size of 2 on each side', () => {
    expect(parseBoxVolume(node('GPUParticlesCollisionBox3D'), {}).size).toEqual({ x: 2, y: 2, z: 2 });
  });

  it('reads the size', () => {
    const { size } = parseBoxVolume(node('GPUParticlesCollisionBox3D'), { size: 'Vector3(3, 1.5, 3)' });
    expect(size).toEqual({ x: 3, y: 1.5, z: 3 });
  });

  it('keeps a size no setter clamps: zero and negative sides stay (edge case)', () => {
    const { size } = parseBoxVolume(node('GPUParticlesCollisionBox3D'), { size: 'Vector3(0, -4, 2000)' });
    expect(size).toEqual({ x: 0, y: -4, z: 2000 });
  });

  it('keeps the default size for a malformed value (error case)', () => {
    const { size } = parseBoxVolume(node('GPUParticlesCollisionBox3D'), { size: 'Vector3(bad)' });
    expect(size).toEqual({ x: 2, y: 2, z: 2 });
  });
});

describe('parseSphereVolume', () => {
  it('reads an empty node as Godot constructs it: a radius of 1', () => {
    expect(parseSphereVolume(node('GPUParticlesAttractorSphere3D'), {}).radius).toBe(1);
  });

  it('reads the radius', () => {
    expect(parseSphereVolume(node('GPUParticlesAttractorSphere3D'), { radius: '2.5' }).radius).toBe(2.5);
  });

  it('keeps a radius no setter clamps: zero and negative stay (edge case)', () => {
    const parse = (radius: string) => parseSphereVolume(node('GPUParticlesAttractorSphere3D'), { radius });
    expect([parse('0').radius, parse('-3').radius]).toEqual([0, -3]);
  });

  it('keeps the default radius for a malformed value (error case)', () => {
    expect(parseSphereVolume(node('GPUParticlesAttractorSphere3D'), { radius: 'wide' }).radius).toBe(1);
  });
});

describe('parseSdfVolume', () => {
  it('reads an empty node as Godot constructs it: RESOLUTION_64 and a size of 2', () => {
    const { size, resolution } = parseSdfVolume(node('GPUParticlesCollisionSDF3D'), {});
    expect([size, resolution]).toEqual([{ x: 2, y: 2, z: 2 }, 2]);
  });

  it('reads the resolution', () => {
    expect(parseSdfVolume(node('GPUParticlesCollisionSDF3D'), { resolution: '0' }).resolution).toBe(0);
  });

  it.each(['6', '-1', 'many'])(
    'keeps the default resolution for %s, which has no Godot value (error case)',
    (resolution) => {
      expect(parseSdfVolume(node('GPUParticlesCollisionSDF3D'), { resolution }).resolution).toBe(2);
    }
  );
});
