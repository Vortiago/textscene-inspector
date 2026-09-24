/**
 * A whole scene carrying non-finite components draws no error, through the real
 * `Linter` with every slice registered. No corpus scene carries a non-finite
 * literal, so this test, not the corpus gate, fails when the grammar narrows.
 */

import { describe, expect, it } from 'vitest';
import { Linter } from './Linter.js';
import './index.js';

/**
 * The error diagnostics only. A malformed literal is always an error, while the
 * scene also draws unrelated "no texture" and "no shape" advisories.
 */
function lintErrors(content: string) {
  return new Linter().lint(content).filter((d) => d.severity === 'error');
}

describe('a scene Godot wrote with non-finite components', () => {
  // `rtos_fix` (`variant_parser.cpp:1985-1997`) writes `inf`, `inf_neg` (a `.tscn`
  // writes with `use_compat` true, `resource_format_text.cpp:1770`) and `nan`, and
  // `_parse_construct` (`:552-596`) reads all four back, `-inf` included.
  it('draws no error from any of them', () => {
    const content = `[gd_scene format=3]

[node name="Root" type="Node3D"]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, inf_neg, 0)

[node name="Sprite" type="Sprite2D" parent="."]
position = Vector2(inf, 0)
scale = Vector2(1, -inf)
modulate = Color(1, 1, 1, nan)
region_rect = Rect2(0, 0, inf, inf)

[node name="Particles" type="CPUParticles3D" parent="."]
emission_points = PackedVector3Array(0, inf, 0, 1, nan, 1)
emission_box_extents = Vector3(inf, 1, 1)

[node name="Body" type="StaticBody3D" parent="."]
constant_angular_velocity = Vector3(0, 0, 0)

[node name="CollisionShape3D" type="CollisionShape3D" parent="Body"]
debug_color = Color(inf, 0.6, 0.7, 0.42)
`;
    expect(lintErrors(content)).toEqual([]);
  });

  it('still reports a component that is not a float literal at all', () => {
    // The widened grammar is Godot's tokenizer, not "anything goes": `infinity`
    // is not one of the four spellings `stor_fix` reads.
    const content = `[gd_scene format=3]

[node name="Sprite" type="Sprite2D"]
position = Vector2(infinity, 0)
`;
    const errors = lintErrors(content);
    expect(errors).toHaveLength(1);
    expect(errors[0]!.message).toContain('position');
  });
});
