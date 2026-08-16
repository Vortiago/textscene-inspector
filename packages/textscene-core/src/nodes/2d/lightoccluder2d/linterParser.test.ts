/**
 * Tests for LightOccluder2D property validators.
 */

import { describe, it, expect } from 'vitest';
import { node, scene, expectClean, expectNoDiagnostic } from '../../../linter/testing/testkit';
import { Linter } from '../../../linter/Linter.js';
import './linterParser';

describe('LightOccluder2D property validators', () => {
  it('sdf_collision accepts boolean values', () => {
    expectClean(scene(node('LightOccluder2D', { sdf_collision: 'true' }, { name: 'Occ' })));
  });

  it('sdf_collision rejects a non-boolean', () => {
    const found = new Linter().lint(scene(node('LightOccluder2D', { sdf_collision: '"maybe"' }, { name: 'Occ' })))
      .find(d => d.message.includes('sdf_collision'));
    expect(found).toBeDefined();
    expect(found?.severity).toBe('error');
  });

  it('sdf_collision accepts false', () => {
    expectClean(scene(node('LightOccluder2D', { sdf_collision: 'false' }, { name: 'Occ' })));
  });

  it('occluder accepts a valid SubResource reference', () => {
    expectClean(`[gd_scene format=3]

[sub_resource type="OccluderPolygon2D" id="1"]
polygon = PackedVector2Array(0, 0, 16, 0)

[node name="Occ" type="LightOccluder2D"]
occluder = SubResource("1")
`);
  });

  it('occluder accepts a valid ExtResource reference', () => {
    expectClean(`[gd_scene format=3]

[ext_resource type="OccluderPolygon2D" path="res://occ.tres" id="1_abc"]

[node name="Occ" type="LightOccluder2D"]
occluder = ExtResource("1_abc")
`);
  });

  it('occluder accepts a dangling SubResource without format error (format-valid but unresolved)', () => {
    // resourceReference only validates format (SubResource/ExtResource syntax);
    // whether the ref resolves to a declared resource is a semantic rule.
    expectClean(
      `[gd_scene format=3]
[sub_resource type="OccluderPolygon2D" id="2"]
polygon = PackedVector2Array(0, 0, 16, 0)

[node name="Occ" type="LightOccluder2D"]
occluder = SubResource("999")
`
    );
  });

  it('does not flag an absent occluder', () => {
    expectNoDiagnostic(scene(node('LightOccluder2D', {}, { name: 'Occ' })), {});
  });

  it('warns on an occluder_light_mask outside the 32-bit width', () => {
    // light_occluder_2d.cpp:300 hints PROPERTY_HINT_LAYERS_2D_RENDER, a
    // 32-checkbox widget, so the width is the UI's and a value outside it
    // warns. set_occluder_light_mask (:257-260) assigns unconditionally, so it
    // is not an error.
    // `-1` is all-layers-on and the widget renders it, so nothing fires;
    // 4294967296 drops a bit the file states, so the slot refuses it.
    const lint = (value: string) =>
      new Linter()
        .lint(scene(node('LightOccluder2D', { occluder_light_mask: value }, { name: 'Occ' })))
        .filter((d) => d.message.includes('occluder_light_mask'));
    expect(lint('-1')).toHaveLength(0);
    expect(lint('4294967296')[0]!.severity).toBe('error');
  });
});
