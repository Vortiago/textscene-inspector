/**
 * Tests for the NavigationObstacle2D rules: carve-without-affect, and the
 * three static-transform checks from `NavigationObstacle2D::get_configuration_warnings()`
 * (navigation_obstacle_2d.cpp:328-345).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Linter } from '../../../linter/Linter';
import './linterParser';
import './linter';

const RULE = 'navigationobstacle2d-carve-without-affect';
const SCALE_RULE = 'navigationobstacle2d-non-positive-global-scale';
const NON_UNIFORM_RULE = 'navigationobstacle2d-non-uniform-global-scale';
const SKEW_RULE = 'navigationobstacle2d-global-skew-ignored';

function reportsOf(diagnostics: ReturnType<Linter['lint']>) {
  return diagnostics.filter((d) => d.ruleName === RULE);
}

describe('NavigationObstacle2D carve-without-affect rule', () => {
  let linter: Linter;

  beforeEach(() => {
    linter = new Linter();
  });

  it('stays quiet when carve_navigation_mesh is off', () => {
    const content = `[gd_scene format=3]

[node name="Root" type="Node2D"]

[node name="Obstacle" type="NavigationObstacle2D" parent="."]
affect_navigation_mesh = false
carve_navigation_mesh = false
`;
    expect(reportsOf(linter.lint(content))).toEqual([]);
  });

  it('stays quiet when both affect_navigation_mesh and carve_navigation_mesh are enabled', () => {
    const content = `[gd_scene format=3]

[node name="Root" type="Node2D"]

[node name="Obstacle" type="NavigationObstacle2D" parent="."]
affect_navigation_mesh = true
carve_navigation_mesh = true
`;
    expect(reportsOf(linter.lint(content))).toEqual([]);
  });

  it('reports when carve_navigation_mesh is enabled but affect_navigation_mesh is explicitly false', () => {
    const content = `[gd_scene format=3]

[node name="Root" type="Node2D"]

[node name="Obstacle" type="NavigationObstacle2D" parent="."]
affect_navigation_mesh = false
carve_navigation_mesh = true
`;
    const warnings = reportsOf(linter.lint(content));
    expect(warnings).toHaveLength(1);
    expect(warnings[0]!.severity).toBe('info');
    expect(warnings[0]!.message).toContain('affect_navigation_mesh');
  });

  it('warns when carve_navigation_mesh is enabled and affect_navigation_mesh is entirely absent (defaults to false)', () => {
    const content = `[gd_scene format=3]

[node name="Root" type="Node2D"]

[node name="Obstacle" type="NavigationObstacle2D" parent="."]
carve_navigation_mesh = true
`;
    const warnings = reportsOf(linter.lint(content));
    expect(warnings).toHaveLength(1);
    expect(warnings[0]!.message).toContain('carve_navigation_mesh');
  });

  it('does not warn about nodes that are not NavigationObstacle2D', () => {
    const content = `[gd_scene format=3]

[node name="Root" type="Node"]

[node name="Sprite" type="Sprite2D" parent="."]
`;
    expect(reportsOf(linter.lint(content))).toEqual([]);
  });
});

/** Diagnostics of one rule name, for one file. */
function only(ruleName: string, content: string) {
  return new Linter().lint(content).filter((d) => d.ruleName === ruleName);
}

describe('NavigationObstacle2D global-scale check (navigation_obstacle_2d.cpp:331-333)', () => {
  it('says nothing at default scale (1, 1)', () => {
    expect(
      only(
        SCALE_RULE,
        `[gd_scene format=3]\n\n[node name="Obstacle" type="NavigationObstacle2D"]\n`
      )
    ).toEqual([]);
  });

  it('warns when the node\'s own scale.x is below 0.001', () => {
    expect(
      only(
        SCALE_RULE,
        `[gd_scene format=3]\n\n[node name="Obstacle" type="NavigationObstacle2D"]\nscale = Vector2(0, 1)\n`
      )
    ).toHaveLength(1);
  });

  it("warns when the node's own scale.y is below 0.001", () => {
    expect(
      only(
        SCALE_RULE,
        `[gd_scene format=3]\n\n[node name="Obstacle" type="NavigationObstacle2D"]\nscale = Vector2(1, 0)\n`
      )
    ).toHaveLength(1);
  });

  it('warns on a negative scale — the guard is < 0.001, not merely <= 0', () => {
    // Vector2(1, -1): a UNIT mirror. get_scale() folds the determinant's sign
    // into y alone (transform_2d.cpp:115-118), so y comes out negative here,
    // well under the 0.001 floor, even though |scale| is 1 on both axes.
    expect(
      only(
        SCALE_RULE,
        `[gd_scene format=3]\n\n[node name="Obstacle" type="NavigationObstacle2D"]\nscale = Vector2(1, -1)\n`
      )
    ).toHaveLength(1);
  });

  it("composes an ancestor's scale into the check", () => {
    const content = `[gd_scene format=3]

[node name="Root" type="Node2D"]
scale = Vector2(0, 1)

[node name="Obstacle" type="NavigationObstacle2D" parent="."]
`;
    expect(only(SCALE_RULE, content)).toHaveLength(1);
  });

  it('says nothing when the ONLY zero-scale ancestor sits above a top_level node', () => {
    const content = `[gd_scene format=3]

[node name="Root" type="Node2D"]
scale = Vector2(0, 1)

[node name="Obstacle" type="NavigationObstacle2D" parent="."]
top_level = true
`;
    expect(only(SCALE_RULE, content)).toEqual([]);
  });

  it('says nothing when composing through a plain Node parent (a known, non-CanvasItem terminus)', () => {
    // "Root" is a plain Node, not a CanvasItem, so get_parent_item() returns
    // null for Obstacle regardless — Obstacle's own scale alone decides this.
    const content = `[gd_scene format=3]

[node name="Root" type="Node"]

[node name="Obstacle" type="NavigationObstacle2D" parent="."]
scale = Vector2(0, 1)
`;
    expect(only(SCALE_RULE, content)).toHaveLength(1);
  });

  it('says nothing when an ancestor is an untyped instance (unknowable)', () => {
    const content = `[gd_scene load_steps=2 format=3]

[ext_resource type="PackedScene" path="res://rig.tscn" id="1"]

[node name="Rig" instance=ExtResource("1")]

[node name="Obstacle" type="NavigationObstacle2D" parent="."]
scale = Vector2(0, 0)
`;
    expect(only(SCALE_RULE, content)).toEqual([]);
  });

  it('says nothing when an ancestor is a Control (a CanvasItem this helper cannot decode)', () => {
    const content = `[gd_scene format=3]

[node name="Root" type="Control"]

[node name="Obstacle" type="NavigationObstacle2D" parent="."]
scale = Vector2(0, 0)
`;
    expect(only(SCALE_RULE, content)).toEqual([]);
  });
});

describe('NavigationObstacle2D non-uniform-scale check (navigation_obstacle_2d.cpp:336-338)', () => {
  it('says nothing when radius is 0 (the default), however scaled', () => {
    const content = `[gd_scene format=3]\n\n[node name="Obstacle" type="NavigationObstacle2D"]\nscale = Vector2(2, 1)\n`;
    expect(only(NON_UNIFORM_RULE, content)).toEqual([]);
  });

  it('warns on a non-uniform scale when radius > 0', () => {
    const content = `[gd_scene format=3]\n\n[node name="Obstacle" type="NavigationObstacle2D"]\nradius = 10.0\nscale = Vector2(2, 1)\n`;
    expect(only(NON_UNIFORM_RULE, content)).toHaveLength(1);
  });

  it('says nothing on a uniform scale when radius > 0', () => {
    const content = `[gd_scene format=3]\n\n[node name="Obstacle" type="NavigationObstacle2D"]\nradius = 10.0\nscale = Vector2(2, 2)\n`;
    expect(only(NON_UNIFORM_RULE, content)).toEqual([]);
  });

  it("composes an ancestor's non-uniform scale into the check", () => {
    const content = `[gd_scene format=3]

[node name="Root" type="Node2D"]
scale = Vector2(2, 1)

[node name="Obstacle" type="NavigationObstacle2D" parent="."]
radius = 10.0
`;
    expect(only(NON_UNIFORM_RULE, content)).toHaveLength(1);
  });
});

describe('NavigationObstacle2D radius readings (navigation_obstacle_2d.cpp:247)', () => {
  it('treats an infinite radius as set, because the setter has no finiteness guard', () => {
    const content = `[gd_scene format=3]\n\n[node name="Obstacle" type="NavigationObstacle2D"]\nradius = inf\nscale = Vector2(2, 1)\n`;
    expect(only(NON_UNIFORM_RULE, content)).toHaveLength(1);
  });

  it('says nothing for a nan radius, which fails `radius > 0` as it does in C++', () => {
    const content = `[gd_scene format=3]\n\n[node name="Obstacle" type="NavigationObstacle2D"]\nradius = nan\nskew = 0.4\n`;
    expect(only(SKEW_RULE, content)).toEqual([]);
  });

  it('reads an exponent-spelled radius at its real magnitude', () => {
    const content = `[gd_scene format=3]\n\n[node name="Obstacle" type="NavigationObstacle2D"]\nradius = 1e1\nskew = 0.4\n`;
    expect(only(SKEW_RULE, content)).toHaveLength(1);
  });
});

describe('NavigationObstacle2D global-skew check (navigation_obstacle_2d.cpp:340-342)', () => {
  it('says nothing when radius is 0 (the default), however skewed', () => {
    const content = `[gd_scene format=3]\n\n[node name="Obstacle" type="NavigationObstacle2D"]\nskew = 0.4\n`;
    expect(only(SKEW_RULE, content)).toEqual([]);
  });

  it('warns on a non-zero skew when radius > 0', () => {
    const content = `[gd_scene format=3]\n\n[node name="Obstacle" type="NavigationObstacle2D"]\nradius = 10.0\nskew = 0.4\n`;
    expect(only(SKEW_RULE, content)).toHaveLength(1);
  });

  it('says nothing when skew is 0 and radius > 0', () => {
    const content = `[gd_scene format=3]\n\n[node name="Obstacle" type="NavigationObstacle2D"]\nradius = 10.0\n`;
    expect(only(SKEW_RULE, content)).toEqual([]);
  });

  it('says nothing when a transform component is narrowed at parse time', () => {
    // `Vector2i(...)` arguments run `_parse_construct<int32_t>`, whose
    // identifier branch reads `inf` through `stor_fix`
    // (variant_parser.cpp:149-159, :577-586), and `_to_int<int32_t>` then
    // narrows it (variant.h:369-370). Godot composes an unskewed transform from
    // whatever int32 it lands on; the NaN that stood in for it made
    // `hasZeroGlobalSkew` answer false and report skew that is not there.
    const content = `[gd_scene format=3]\n\n[node name="Obstacle" type="NavigationObstacle2D"]\nradius = 10.0\nscale = Vector2i(inf, 1)\n`;
    expect(only(SKEW_RULE, content)).toEqual([]);
    expect(only(NON_UNIFORM_RULE, content)).toEqual([]);
    expect(only(SCALE_RULE, content)).toEqual([]);
  });

  it('says nothing on a plain rotation (no skew) at a non-trivial angle, when radius > 0', () => {
    // A pure rotation must never read as skew, however the trig rounds.
    const content = `[gd_scene format=3]\n\n[node name="Obstacle" type="NavigationObstacle2D"]\nradius = 10.0\nrotation = 0.3927\n`;
    expect(only(SKEW_RULE, content)).toEqual([]);
  });

  it('says nothing on a degenerate (zero-length) axis, matching Vector2::normalize()\'s zero-vector guard', () => {
    // core/math/vector2.cpp's normalize() guards `if (l != 0)`, so a
    // zero-length column normalizes to the zero vector; the dot is then 0,
    // acos(0) is PI/2, and get_skew() returns exactly 0 — Godot stays silent
    // here even though the transform is otherwise degenerate (and DOES trip
    // the separate scale-floor check below).
    const content = `[gd_scene format=3]\n\n[node name="Obstacle" type="NavigationObstacle2D"]\nradius = 10.0\nscale = Vector2(0, 1)\n`;
    expect(only(SKEW_RULE, content)).toEqual([]);
    expect(only(SCALE_RULE, content)).toHaveLength(1);
  });

  it("says nothing when the two axes are parallel but non-zero, where SIGN(det) is 0", () => {
    // The zero-LENGTH guard above does not cover a zero DETERMINANT: here both
    // columns have length, but they are parallel. `get_skew()` multiplies
    // `columns[1].normalized()` by `SIGN(det)` (transform_2d.cpp:74), which is
    // exactly 0 (typedefs.h:123-126), so the dot is 0 and the skew is exactly
    // 0 — navigation_obstacle_2d.cpp:340 compares `!= 0.0` and stays silent.
    // Composed, since Node2D never serialises `transform` directly.
    const content = `[gd_scene format=3]\n\n[node name="Root" type="Node2D"]\nscale = Vector2(1, 0)\n\n[node name="Obstacle" type="NavigationObstacle2D" parent="."]\nradius = 10.0\nrotation = 0.785398\n`;
    expect(only(SKEW_RULE, content)).toEqual([]);
  });
});
