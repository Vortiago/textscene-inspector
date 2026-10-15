import { describe, expect, it } from 'vitest';
import { FogVolumeShape } from '../../../godot/rendering/environment/fogVolume';
import { heading } from '../../../parser/testing/parserKit';
import { TscnParser } from '../../../parser/TscnParser';
import { parseFogVolume } from './parser';

describe('parseFogVolume', () => {
  it('reads an empty FogVolume as Godot constructs it: a 2×2×2 box with no material', () => {
    const result = parseFogVolume(heading('FogVolume', { name: 'Fog' }), {});
    expect(result).toMatchObject({ size: { x: 2, y: 2, z: 2 }, shape: FogVolumeShape.BOX });
    expect(result.material).toBeUndefined();
  });

  it('reads the size, the shape and the material reference', () => {
    const result = parseFogVolume(heading('FogVolume', { name: 'Fog' }), {
      size: 'Vector3(4, 3, 4)',
      shape: '2',
      material: 'SubResource("FogMaterial_1")',
    });
    expect(result).toMatchObject({
      size: { x: 4, y: 3, z: 4 },
      shape: FogVolumeShape.CYLINDER,
      material: 'SubResource("FogMaterial_1")',
    });
  });

  it('clamps each negative size component to 0, as set_size does (edge case)', () => {
    const result = parseFogVolume(heading('FogVolume', { name: 'Fog' }), { size: 'Vector3(-1, 2, 2)' });
    expect(result.size).toEqual({ x: 0, y: 2, z: 2 });
  });

  it('keeps an out-of-range shape, which set_shape stores unchecked (edge case)', () => {
    expect(parseFogVolume(heading('FogVolume', { name: 'Fog' }), { shape: '7' }).shape).toBe(7);
  });

  it('keeps the default size for a malformed one (error case)', () => {
    expect(parseFogVolume(heading('FogVolume', { name: 'Fog' }), { size: 'Vector3(oops)' }).size).toEqual({
      x: 2,
      y: 2,
      z: 2,
    });
  });

  it('reads a Godot 3 `extents` as the doubled size through the scene parser', () => {
    const scene = new TscnParser().parse(
      '[gd_scene format=3]\n\n[node name="Fog" type="FogVolume"]\nextents = Vector3(1, 2, 3)\n'
    );
    expect((scene.nodes[0]!.properties as { size: unknown }).size).toEqual({ x: 2, y: 4, z: 6 });
  });
});
