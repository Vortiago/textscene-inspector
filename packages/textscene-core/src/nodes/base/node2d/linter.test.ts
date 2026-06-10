/**
 * Tests for Node2D linter (strict parser validators). Node2D registers no
 * semantic rule — it is a base class; semantic validation lives in the
 * subclasses (see index.linter.ts).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Linter } from '../../../linter/Linter';
import './linterParser'; // Import to trigger validator registration

describe('Node2D Linter', () => {
  let linter: Linter;

  beforeEach(() => {
    linter = new Linter();
  });

  describe('Strict Parser Validation - Position Properties', () => {
    it('should pass validation for valid position', () => {
      const content = `[gd_scene format=3]

[node name="ValidNode" type="Node2D"]
position = Vector2(100, 50)
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    it('should pass validation for negative position values', () => {
      const content = `[gd_scene format=3]

[node name="ValidNode" type="Node2D"]
position = Vector2(-100, -50)
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    it('should pass validation for scientific notation in position', () => {
      const content = `[gd_scene format=3]

[node name="ValidNode" type="Node2D"]
position = Vector2(1.5e2, 2.1e-1)
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    it('should detect invalid position format - too few values', () => {
      const content = `[gd_scene format=3]

[node name="InvalidPosition" type="Node2D"]
position = Vector2(100)
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0]).toMatchObject({
        severity: 'error',
        ruleName: 'strict-parser',
      });
      expect(diagnostics[0].message).toContain('position');
      expect(diagnostics[0].message).toContain('2 numbers');
    });

    it('should detect invalid position format - too many values', () => {
      const content = `[gd_scene format=3]

[node name="InvalidPosition" type="Node2D"]
position = Vector2(100, 50, 25)
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0]).toMatchObject({
        severity: 'error',
        ruleName: 'strict-parser',
      });
      expect(diagnostics[0].message).toContain('position');
    });

    it('should detect invalid position format - wrong type', () => {
      const content = `[gd_scene format=3]

[node name="InvalidPosition" type="Node2D"]
position = Vector3(100, 50, 0)
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0]).toMatchObject({
        severity: 'error',
        ruleName: 'strict-parser',
      });
      expect(diagnostics[0].message).toContain('position');
    });

    it('should pass validation for valid global_position', () => {
      const content = `[gd_scene format=3]

[node name="ValidNode" type="Node2D"]
global_position = Vector2(100, 50)
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });
  });

  describe('Strict Parser Validation - Rotation Properties', () => {
    it('should pass validation for valid rotation', () => {
      const content = `[gd_scene format=3]

[node name="ValidNode" type="Node2D"]
rotation = 1.5708
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    it('should pass validation for negative rotation', () => {
      const content = `[gd_scene format=3]

[node name="ValidNode" type="Node2D"]
rotation = -1.5708
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    it('should pass validation for zero rotation', () => {
      const content = `[gd_scene format=3]

[node name="ValidNode" type="Node2D"]
rotation = 0
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    it('should detect invalid rotation format', () => {
      const content = `[gd_scene format=3]

[node name="InvalidRotation" type="Node2D"]
rotation = "ninety degrees"
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0]).toMatchObject({
        severity: 'error',
        ruleName: 'strict-parser',
      });
      expect(diagnostics[0].message).toContain('rotation');
      expect(diagnostics[0].message).toContain('number');
    });

    it('should pass validation for valid rotation_degrees', () => {
      const content = `[gd_scene format=3]

[node name="ValidNode" type="Node2D"]
rotation_degrees = 90
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    it('should pass validation for rotation_degrees with decimal', () => {
      const content = `[gd_scene format=3]

[node name="ValidNode" type="Node2D"]
rotation_degrees = 45.5
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    it('should detect invalid rotation_degrees format', () => {
      const content = `[gd_scene format=3]

[node name="InvalidRotation" type="Node2D"]
rotation_degrees = Vector2(90, 0)
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0]).toMatchObject({
        severity: 'error',
        ruleName: 'strict-parser',
      });
      expect(diagnostics[0].message).toContain('rotation_degrees');
    });

    it('should pass validation for valid global_rotation', () => {
      const content = `[gd_scene format=3]

[node name="ValidNode" type="Node2D"]
global_rotation = 3.14159
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    it('should pass validation for valid global_rotation_degrees', () => {
      const content = `[gd_scene format=3]

[node name="ValidNode" type="Node2D"]
global_rotation_degrees = 180
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });
  });

  describe('Strict Parser Validation - Scale Properties', () => {
    it('should pass validation for valid scale', () => {
      const content = `[gd_scene format=3]

[node name="ValidNode" type="Node2D"]
scale = Vector2(1, 1)
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    it('should pass validation for non-uniform scale', () => {
      const content = `[gd_scene format=3]

[node name="ValidNode" type="Node2D"]
scale = Vector2(2, 0.5)
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    it('should pass validation for negative scale', () => {
      const content = `[gd_scene format=3]

[node name="ValidNode" type="Node2D"]
scale = Vector2(-1, 1)
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    it('should detect zero scale value on x-axis', () => {
      const content = `[gd_scene format=3]

[node name="ZeroScale" type="Node2D"]
scale = Vector2(0, 1)
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0]).toMatchObject({
        severity: 'error',
        ruleName: 'strict-parser',
      });
      expect(diagnostics[0].message).toContain('scale');
      expect(diagnostics[0].message).toContain('non-zero');
      expect(diagnostics[0].message).toContain('rendering issues');
    });

    it('should detect zero scale value on y-axis', () => {
      const content = `[gd_scene format=3]

[node name="ZeroScale" type="Node2D"]
scale = Vector2(1, 0)
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0]).toMatchObject({
        severity: 'error',
        ruleName: 'strict-parser',
      });
      expect(diagnostics[0].message).toContain('scale');
      expect(diagnostics[0].message).toContain('non-zero');
    });

    it('should detect zero scale on both axes', () => {
      const content = `[gd_scene format=3]

[node name="ZeroScale" type="Node2D"]
scale = Vector2(0, 0)
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0]).toMatchObject({
        severity: 'error',
        ruleName: 'strict-parser',
      });
      expect(diagnostics[0].message).toContain('scale');
      expect(diagnostics[0].message).toContain('non-zero');
    });

    it('should detect extreme scale value - too large', () => {
      const content = `[gd_scene format=3]

[node name="ExtremeScale" type="Node2D"]
scale = Vector2(10000, 1)
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0]).toMatchObject({
        severity: 'error',
        ruleName: 'strict-parser',
      });
      expect(diagnostics[0].message).toContain('scale');
      expect(diagnostics[0].message).toContain('extreme');
      expect(diagnostics[0].message).toContain('precision');
    });

    it('should detect extreme scale value - too small', () => {
      const content = `[gd_scene format=3]

[node name="ExtremeScale" type="Node2D"]
scale = Vector2(0.0001, 1)
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0]).toMatchObject({
        severity: 'error',
        ruleName: 'strict-parser',
      });
      expect(diagnostics[0].message).toContain('scale');
      expect(diagnostics[0].message).toContain('extreme');
    });

    it('should detect invalid scale format', () => {
      const content = `[gd_scene format=3]

[node name="InvalidScale" type="Node2D"]
scale = Vector2(1)
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0]).toMatchObject({
        severity: 'error',
        ruleName: 'strict-parser',
      });
      expect(diagnostics[0].message).toContain('scale');
      expect(diagnostics[0].message).toContain('2 numbers');
    });

    it('should pass validation for valid global_scale', () => {
      const content = `[gd_scene format=3]

[node name="ValidNode" type="Node2D"]
global_scale = Vector2(2, 2)
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });
  });

  describe('Strict Parser Validation - Skew Properties', () => {
    it('should pass validation for valid skew', () => {
      const content = `[gd_scene format=3]

[node name="ValidNode" type="Node2D"]
skew = 0.5
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    it('should pass validation for zero skew', () => {
      const content = `[gd_scene format=3]

[node name="ValidNode" type="Node2D"]
skew = 0
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    it('should pass validation for negative skew', () => {
      const content = `[gd_scene format=3]

[node name="ValidNode" type="Node2D"]
skew = -0.25
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    it('should detect invalid skew format', () => {
      const content = `[gd_scene format=3]

[node name="InvalidSkew" type="Node2D"]
skew = "slanted"
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0]).toMatchObject({
        severity: 'error',
        ruleName: 'strict-parser',
      });
      expect(diagnostics[0].message).toContain('skew');
      expect(diagnostics[0].message).toContain('number');
    });

    it('should pass validation for valid global_skew', () => {
      const content = `[gd_scene format=3]

[node name="ValidNode" type="Node2D"]
global_skew = 0.3
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });
  });

  describe('Strict Parser Validation - Transform Properties', () => {
    it('should pass validation for valid transform', () => {
      const content = `[gd_scene format=3]

[node name="ValidNode" type="Node2D"]
transform = Transform2D(1, 0, 0, 1, 0, 0)
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    it('should pass validation for transform with translation', () => {
      const content = `[gd_scene format=3]

[node name="ValidNode" type="Node2D"]
transform = Transform2D(1, 0, 0, 1, 100, 50)
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    it('should pass validation for rotated transform', () => {
      const content = `[gd_scene format=3]

[node name="ValidNode" type="Node2D"]
transform = Transform2D(0.707, 0.707, -0.707, 0.707, 0, 0)
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    it('should detect invalid transform format - too few values', () => {
      const content = `[gd_scene format=3]

[node name="InvalidTransform" type="Node2D"]
transform = Transform2D(1, 0, 0, 1)
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0]).toMatchObject({
        severity: 'error',
        ruleName: 'strict-parser',
      });
      expect(diagnostics[0].message).toContain('transform');
      expect(diagnostics[0].message).toContain('6 numbers');
    });

    it('should detect invalid transform format - wrong type', () => {
      const content = `[gd_scene format=3]

[node name="InvalidTransform" type="Node2D"]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0)
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0]).toMatchObject({
        severity: 'error',
        ruleName: 'strict-parser',
      });
      expect(diagnostics[0].message).toContain('transform');
    });

    it('should pass validation for valid global_transform', () => {
      const content = `[gd_scene format=3]

[node name="ValidNode" type="Node2D"]
global_transform = Transform2D(1, 0, 0, 1, 200, 100)
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });
  });

  describe('Strict Parser Validation - Z-Index Properties', () => {
    it('should pass validation for valid z_index', () => {
      const content = `[gd_scene format=3]

[node name="ValidNode" type="Node2D"]
z_index = 10
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    it('should pass validation for negative z_index', () => {
      const content = `[gd_scene format=3]

[node name="ValidNode" type="Node2D"]
z_index = -5
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    it('should pass validation for zero z_index', () => {
      const content = `[gd_scene format=3]

[node name="ValidNode" type="Node2D"]
z_index = 0
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    it('should detect invalid z_index format - float', () => {
      const content = `[gd_scene format=3]

[node name="InvalidZIndex" type="Node2D"]
z_index = 10.5
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0]).toMatchObject({
        severity: 'error',
        ruleName: 'strict-parser',
      });
      expect(diagnostics[0].message).toContain('z_index');
      expect(diagnostics[0].message).toContain('integer');
    });

    it('should detect invalid z_index format - string', () => {
      const content = `[gd_scene format=3]

[node name="InvalidZIndex" type="Node2D"]
z_index = "ten"
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0]).toMatchObject({
        severity: 'error',
        ruleName: 'strict-parser',
      });
      expect(diagnostics[0].message).toContain('z_index');
    });

    it('should pass validation for valid z_as_relative', () => {
      const content = `[gd_scene format=3]

[node name="ValidNode" type="Node2D"]
z_as_relative = true
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    it('should pass validation for z_as_relative = false', () => {
      const content = `[gd_scene format=3]

[node name="ValidNode" type="Node2D"]
z_as_relative = false
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    it('should detect invalid z_as_relative format', () => {
      const content = `[gd_scene format=3]

[node name="InvalidZAsRelative" type="Node2D"]
z_as_relative = 1
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0]).toMatchObject({
        severity: 'error',
        ruleName: 'strict-parser',
      });
      expect(diagnostics[0].message).toContain('z_as_relative');
      expect(diagnostics[0].message).toContain('boolean');
    });
  });

  describe('Strict Parser Validation - Y-Sort Properties', () => {
    it('should pass validation for valid y_sort_enabled', () => {
      const content = `[gd_scene format=3]

[node name="ValidNode" type="Node2D"]
y_sort_enabled = true
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    it('should pass validation for y_sort_enabled = false', () => {
      const content = `[gd_scene format=3]

[node name="ValidNode" type="Node2D"]
y_sort_enabled = false
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    it('should detect invalid y_sort_enabled format', () => {
      const content = `[gd_scene format=3]

[node name="InvalidYSort" type="Node2D"]
y_sort_enabled = yes
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0]).toMatchObject({
        severity: 'error',
        ruleName: 'strict-parser',
      });
      expect(diagnostics[0].message).toContain('y_sort_enabled');
      expect(diagnostics[0].message).toContain('boolean');
    });
  });

  describe('Combined Properties Validation', () => {
    it('should pass validation for node with multiple valid properties', () => {
      const content = `[gd_scene format=3]

[node name="ComplexNode" type="Node2D"]
position = Vector2(100, 50)
rotation_degrees = 45
scale = Vector2(2, 2)
skew = 0.1
z_index = 5
z_as_relative = true
y_sort_enabled = false
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    it('should detect multiple errors in a single node', () => {
      const content = `[gd_scene format=3]

[node name="ErrorNode" type="Node2D"]
position = Vector2(100)
scale = Vector2(0, 1)
z_index = 5.5
y_sort_enabled = maybe
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics.length).toBeGreaterThanOrEqual(4);
      expect(diagnostics.some(d => d.message.includes('position'))).toBe(true);
      expect(diagnostics.some(d => d.message.includes('scale'))).toBe(true);
      expect(diagnostics.some(d => d.message.includes('z_index'))).toBe(true);
      expect(diagnostics.some(d => d.message.includes('y_sort_enabled'))).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle nodes without any transform properties', () => {
      const content = `[gd_scene format=3]

[node name="MinimalNode" type="Node2D"]
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    it('should handle very small valid scale values', () => {
      const content = `[gd_scene format=3]

[node name="SmallScale" type="Node2D"]
scale = Vector2(0.01, 0.01)
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    it('should handle very large valid scale values', () => {
      const content = `[gd_scene format=3]

[node name="LargeScale" type="Node2D"]
scale = Vector2(100, 100)
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    it('should handle extreme rotation values', () => {
      const content = `[gd_scene format=3]

[node name="ExtremeRotation" type="Node2D"]
rotation = 6.28318
rotation_degrees = 720
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    it('should handle scientific notation in transform', () => {
      const content = `[gd_scene format=3]

[node name="ScientificTransform" type="Node2D"]
transform = Transform2D(1e0, 0e0, 0e0, 1e0, 1e2, 5e1)
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    it('should handle Node2D properties on subclasses (e.g., Sprite2D)', () => {
      const content = `[gd_scene format=3]

[node name="SpriteNode" type="Node2D"]
position = Vector2(50, 50)
scale = Vector2(0, 1)
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics.length).toBeGreaterThan(0);
      // Should catch the zero scale error
      expect(diagnostics.some(d => d.message.includes('scale'))).toBe(true);
    });

    it('should handle large z_index values', () => {
      const content = `[gd_scene format=3]

[node name="LargeZIndex" type="Node2D"]
z_index = 999999
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    it('should handle very small negative z_index', () => {
      const content = `[gd_scene format=3]

[node name="SmallZIndex" type="Node2D"]
z_index = -999999
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });
  });

  describe('Scale Boundary Testing', () => {
    it('should pass for scale exactly at lower threshold', () => {
      const content = `[gd_scene format=3]

[node name="ThresholdScale" type="Node2D"]
scale = Vector2(0.001, 0.001)
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    it('should pass for scale exactly at upper threshold', () => {
      const content = `[gd_scene format=3]

[node name="ThresholdScale" type="Node2D"]
scale = Vector2(1000, 1000)
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    it('should fail for scale just below lower threshold', () => {
      const content = `[gd_scene format=3]

[node name="BelowThreshold" type="Node2D"]
scale = Vector2(0.0009, 1)
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0].message).toContain('extreme');
    });

    it('should fail for scale just above upper threshold', () => {
      const content = `[gd_scene format=3]

[node name="AboveThreshold" type="Node2D"]
scale = Vector2(1001, 1)
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0].message).toContain('extreme');
    });
  });
});
