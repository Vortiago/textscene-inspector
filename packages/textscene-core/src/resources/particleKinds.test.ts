/**
 * A Curve, a Gradient and a ParticleProcessMaterial decode to the same value from each origin: a
 * `[sub_resource]` of the scene, a `.tres` of its own, and a `[sub_resource]` of another `.tres`.
 */

import { describe, expect, it } from 'vitest';
import { CURVE } from './curves/curve/decode';
import { GRADIENT } from './textures/gradienttexture2d/decode';
import { PARTICLE_PROCESS_MATERIAL } from './materials/particleprocessmaterial/decode';
import { staticSnapshot } from './reading/staticSnapshot.testkit';
import { nodeReference } from './reading/scopedReference';
import { sceneTables } from './reading/reading.testkit';
import type { ResourceKind } from './reading/read';

interface KindCase {
  readonly kind: ResourceKind<unknown>;
  readonly className: string;
  readonly body: string;
  /** A resource of another class, which the kind declines. */
  readonly otherClass: string;
}

const KINDS: readonly KindCase[] = [
  {
    kind: CURVE,
    className: 'Curve',
    body: '_limits = [0.0, 2.0, 0.0, 1.0]\n_data = [Vector2(0, 1), 0.0, 0.0, 0, 0, Vector2(1, 0), 0.0, 0.0, 0, 0]\npoint_count = 2',
    otherClass: 'Gradient',
  },
  {
    kind: GRADIENT,
    className: 'Gradient',
    body: 'offsets = PackedFloat32Array(0, 1)\ncolors = PackedColorArray(1, 0, 0, 1, 0, 0, 1, 1)',
    otherClass: 'Curve',
  },
  {
    kind: PARTICLE_PROCESS_MATERIAL,
    className: 'ParticleProcessMaterial',
    body: 'emission_shape = 2\nemission_sphere_radius = 3.0\nemission_shape_offset = Vector3(1, 2, 3)',
    otherClass: 'ShaderMaterial',
  },
];

function readAt(kase: KindCase, ref: string, scene: string, files: Record<string, string> = {}) {
  return staticSnapshot(files).read(nodeReference(ref, sceneTables(scene)), kase.kind);
}

function loadedAt(kase: KindCase, ref: string, scene: string, files: Record<string, string> = {}) {
  const read = readAt(kase, ref, scene, files);
  if (read.status !== 'loaded') throw new Error(`expected the ${kase.className} to load, got ${read.status}`);
  return read.value;
}

describe.each(KINDS)('the $className kind', (kase) => {
  const inScene = () =>
    loadedAt(kase, 'SubResource("r")', `[sub_resource type="${kase.className}" id="r"]\n${kase.body}`);

  it('decodes the same value from a .tres of its own as from a sub-resource of the scene', () => {
    const files = {
      'res://r.tres': `[gd_resource type="${kase.className}" format=3]\n\n[resource]\n${kase.body}\n`,
    };
    const scene = `[ext_resource type="${kase.className}" path="res://r.tres" id="1_r"]`;

    expect(loadedAt(kase, 'ExtResource("1_r")', scene, files)).toEqual(inScene());
  });

  it('decodes the same value from a sub-resource of another .tres', () => {
    const files = {
      'res://holder.tres': `[gd_resource type="Resource" format=3]\n\n[sub_resource type="${kase.className}" id="r"]\n${kase.body}\n\n[resource]\n`,
    };

    expect(loadedAt(kase, 'res://holder.tres::r', '', files)).toEqual(inScene());
  });

  it('declines a resource of another class', () => {
    const read = readAt(kase, 'SubResource("r")', `[sub_resource type="${kase.otherClass}" id="r"]`);

    expect(read).toMatchObject({ status: 'unavailable', reason: 'wrong-type' });
  });
});
