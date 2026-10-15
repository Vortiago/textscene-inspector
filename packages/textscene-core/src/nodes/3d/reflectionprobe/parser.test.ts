import { describe, expect, it } from 'vitest';
import {
  ReflectionProbeAmbientMode,
  ReflectionProbeUpdateMode,
} from '../../../godot/rendering/environment/reflectionProbe';
import { heading } from '../../../parser/testing/parserKit';
import { TscnParser } from '../../../parser/TscnParser';
import { parseReflectionProbe } from './parser';

const probe = (properties: Record<string, string>) =>
  parseReflectionProbe(heading('ReflectionProbe', { name: 'Probe' }), properties);

describe('parseReflectionProbe', () => {
  it('reads an empty probe as Godot constructs it', () => {
    expect(probe({})).toMatchObject({
      updateMode: ReflectionProbeUpdateMode.ONCE,
      intensity: 1,
      blendDistance: 1,
      maxDistance: 0,
      size: { x: 20, y: 20, z: 20 },
      originOffset: { x: 0, y: 0, z: 0 },
      boxProjection: false,
      interior: false,
      enableShadows: false,
      cullMask: (1 << 20) - 1,
      reflectionMask: (1 << 20) - 1,
      ambientMode: ReflectionProbeAmbientMode.ENVIRONMENT,
      ambientColor: { r: 0, g: 0, b: 0, a: 1 },
      ambientColorEnergy: 1,
    });
  });

  it('reads every property the probe draws with', () => {
    expect(
      probe({
        update_mode: '1',
        intensity: '0.5',
        blend_distance: '2',
        max_distance: '30',
        size: 'Vector3(4, 6, 8)',
        origin_offset: 'Vector3(1, 0, -1)',
        box_projection: 'true',
        interior: 'true',
        enable_shadows: 'true',
        cull_mask: '1',
        reflection_mask: '4294967295',
        ambient_mode: '2',
        ambient_color: 'Color(1, 0.5, 0, 1)',
        ambient_color_energy: '3',
      })
    ).toMatchObject({
      updateMode: ReflectionProbeUpdateMode.ALWAYS,
      intensity: 0.5,
      blendDistance: 2,
      maxDistance: 30,
      size: { x: 4, y: 6, z: 8 },
      originOffset: { x: 1, y: 0, z: -1 },
      boxProjection: true,
      interior: true,
      enableShadows: true,
      cullMask: 1,
      reflectionMask: 4294967295,
      ambientMode: ReflectionProbeAmbientMode.COLOR,
      ambientColor: { r: 1, g: 0.5, b: 0, a: 1 },
      ambientColorEnergy: 3,
    });
  });

  it('clamps the origin offset inside the size, in the order the file lists them (edge case)', () => {
    expect(probe({ origin_offset: 'Vector3(5, 0, 0)', size: 'Vector3(4, 4, 4)' }).originOffset.x).toBeCloseTo(
      1.99,
      6
    );
  });

  it('clamps max_distance to what set_max_distance keeps (edge case)', () => {
    expect([probe({ max_distance: '-3' }).maxDistance, probe({ max_distance: '1e9' }).maxDistance]).toEqual([
      0, 262_144,
    ]);
  });

  it('reads an ambient mode the shader has no case for as no ambient (edge case)', () => {
    expect(probe({ ambient_mode: '7' }).ambientMode).toBe(ReflectionProbeAmbientMode.DISABLED);
  });

  it('keeps the defaults for malformed values (error case)', () => {
    expect(probe({ size: 'Vector3(oops)', intensity: 'bright' })).toMatchObject({
      size: { x: 20, y: 20, z: 20 },
      intensity: 1,
    });
  });

  it('reads a Godot 3 `extents` as the doubled size through the scene parser', () => {
    const scene = new TscnParser().parse(
      '[gd_scene format=3]\n\n[node name="Probe" type="ReflectionProbe"]\nextents = Vector3(1, 2, 3)\n'
    );
    expect((scene.nodes[0]!.properties as { size: unknown }).size).toEqual({ x: 2, y: 4, z: 6 });
  });
});
