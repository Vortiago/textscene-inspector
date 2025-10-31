/**
 * Tests for Node3D linter (strict parser + semantic rules)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Linter } from '../../../linter/Linter';
import './linterParser'; // Import to trigger validator registration
import './linter'; // Import to trigger rule registration

describe('Node3D Linter', () => {
  let linter: Linter;

  beforeEach(() => {
    linter = new Linter();
  });

  describe('Strict Parser Validation - Transform Properties', () => {
    it('should pass validation for valid transform', () => {
      const content = `[gd_scene format=3]

[node name="ValidNode" type="Node3D"]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0)
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    it('should detect invalid transform format - too few values', () => {
      const content = `[gd_scene format=3]

[node name="InvalidTransform" type="Node3D"]
transform = Transform3D(1, 0, 0)
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0]).toMatchObject({
        severity: 'error',
        ruleName: 'strict-parser',
      });
      expect(diagnostics[0].message).toContain('transform');
      expect(diagnostics[0].message).toContain('12 numbers');
    });

    it('should detect invalid transform format - not a Transform3D', () => {
      const content = `[gd_scene format=3]

[node name="InvalidTransform" type="Node3D"]
transform = Vector3(1, 0, 0)
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

[node name="ValidNode" type="Node3D"]
global_transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 5, 10, 15)
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });
  });

  describe('Strict Parser Validation - Position Properties', () => {
    it('should pass validation for valid position', () => {
      const content = `[gd_scene format=3]

[node name="ValidNode" type="Node3D"]
position = Vector3(1, 2, 3)
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    it('should detect invalid position format', () => {
      const content = `[gd_scene format=3]

[node name="InvalidPosition" type="Node3D"]
position = Vector3(1, 2)
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0]).toMatchObject({
        severity: 'error',
        ruleName: 'strict-parser',
      });
      expect(diagnostics[0].message).toContain('position');
      expect(diagnostics[0].message).toContain('3 numbers');
    });

    it('should pass validation for negative position values', () => {
      const content = `[gd_scene format=3]

[node name="ValidNode" type="Node3D"]
position = Vector3(-10, -20, -30)
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    it('should pass validation for scientific notation in position', () => {
      const content = `[gd_scene format=3]

[node name="ValidNode" type="Node3D"]
position = Vector3(1.5e-3, 2.1e+2, 3.0e0)
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });
  });

  describe('Strict Parser Validation - Rotation Properties', () => {
    it('should pass validation for valid rotation', () => {
      const content = `[gd_scene format=3]

[node name="ValidNode" type="Node3D"]
rotation = Vector3(0, 1.5708, 0)
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    it('should pass validation for valid rotation_degrees', () => {
      const content = `[gd_scene format=3]

[node name="ValidNode" type="Node3D"]
rotation_degrees = Vector3(0, 90, 0)
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    it('should detect invalid rotation format', () => {
      const content = `[gd_scene format=3]

[node name="InvalidRotation" type="Node3D"]
rotation = Vector3(0, 90)
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0]).toMatchObject({
        severity: 'error',
        ruleName: 'strict-parser',
      });
      expect(diagnostics[0].message).toContain('rotation');
    });

    it('should pass validation for valid rotation_order', () => {
      const validOrders = [0, 1, 2, 3, 4, 5]; // XYZ, XZY, YXZ, YZX, ZXY, ZYX

      for (const order of validOrders) {
        const content = `[gd_scene format=3]

[node name="ValidNode${order}" type="Node3D"]
rotation_order = ${order}
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      }
    });

    it('should detect invalid rotation_order value', () => {
      const content = `[gd_scene format=3]

[node name="InvalidRotationOrder" type="Node3D"]
rotation_order = 99
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0]).toMatchObject({
        severity: 'error',
        ruleName: 'strict-parser',
      });
      expect(diagnostics[0].message).toContain('rotation_order');
      expect(diagnostics[0].message).toContain('0-5');
    });
  });

  describe('Strict Parser Validation - Scale Properties', () => {
    it('should pass validation for valid scale', () => {
      const content = `[gd_scene format=3]

[node name="ValidNode" type="Node3D"]
scale = Vector3(1, 1, 1)
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    it('should pass validation for non-uniform scale', () => {
      const content = `[gd_scene format=3]

[node name="ValidNode" type="Node3D"]
scale = Vector3(2, 0.5, 1.5)
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    it('should detect zero scale value', () => {
      const content = `[gd_scene format=3]

[node name="ZeroScale" type="Node3D"]
scale = Vector3(0, 1, 1)
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0]).toMatchObject({
        severity: 'error',
        ruleName: 'strict-parser',
      });
      expect(diagnostics[0].message).toContain('scale');
      expect(diagnostics[0].message).toContain('positive');
    });

    it('should detect negative scale value', () => {
      const content = `[gd_scene format=3]

[node name="NegativeScale" type="Node3D"]
scale = Vector3(1, -1, 1)
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0]).toMatchObject({
        severity: 'error',
        ruleName: 'strict-parser',
      });
      expect(diagnostics[0].message).toContain('scale');
      expect(diagnostics[0].message).toContain('positive');
    });

    it('should detect extreme scale value - too large', () => {
      const content = `[gd_scene format=3]

[node name="ExtremeScale" type="Node3D"]
scale = Vector3(10000, 1, 1)
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

[node name="ExtremeScale" type="Node3D"]
scale = Vector3(0.0001, 1, 1)
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

[node name="InvalidScale" type="Node3D"]
scale = Vector3(1, 1)
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0]).toMatchObject({
        severity: 'error',
        ruleName: 'strict-parser',
      });
      expect(diagnostics[0].message).toContain('scale');
      expect(diagnostics[0].message).toContain('3 numbers');
    });
  });

  describe('Strict Parser Validation - Quaternion and Basis', () => {
    it('should pass validation for valid quaternion', () => {
      const content = `[gd_scene format=3]

[node name="ValidNode" type="Node3D"]
quaternion = Quaternion(0, 0, 0, 1)
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    it('should detect invalid quaternion format', () => {
      const content = `[gd_scene format=3]

[node name="InvalidQuaternion" type="Node3D"]
quaternion = Quaternion(0, 0, 1)
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0]).toMatchObject({
        severity: 'error',
        ruleName: 'strict-parser',
      });
      expect(diagnostics[0].message).toContain('quaternion');
      expect(diagnostics[0].message).toContain('4 numbers');
    });

    it('should pass validation for valid basis', () => {
      const content = `[gd_scene format=3]

[node name="ValidNode" type="Node3D"]
basis = Basis(1, 0, 0, 0, 1, 0, 0, 0, 1)
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    it('should detect invalid basis format', () => {
      const content = `[gd_scene format=3]

[node name="InvalidBasis" type="Node3D"]
basis = Basis(1, 0, 0, 0, 1, 0)
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0]).toMatchObject({
        severity: 'error',
        ruleName: 'strict-parser',
      });
      expect(diagnostics[0].message).toContain('basis');
      expect(diagnostics[0].message).toContain('9 numbers');
    });
  });

  describe('Strict Parser Validation - Visibility Properties', () => {
    it('should pass validation for valid visible property', () => {
      const content = `[gd_scene format=3]

[node name="ValidNode" type="Node3D"]
visible = true
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    it('should pass validation for visible = false', () => {
      const content = `[gd_scene format=3]

[node name="ValidNode" type="Node3D"]
visible = false
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    it('should detect invalid visible format', () => {
      const content = `[gd_scene format=3]

[node name="InvalidVisible" type="Node3D"]
visible = 1
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0]).toMatchObject({
        severity: 'error',
        ruleName: 'strict-parser',
      });
      expect(diagnostics[0].message).toContain('visible');
      expect(diagnostics[0].message).toContain('boolean');
    });

    it('should pass validation for valid top_level property', () => {
      const content = `[gd_scene format=3]

[node name="ValidNode" type="Node3D"]
top_level = true
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    it('should detect invalid top_level format', () => {
      const content = `[gd_scene format=3]

[node name="InvalidTopLevel" type="Node3D"]
top_level = yes
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0]).toMatchObject({
        severity: 'error',
        ruleName: 'strict-parser',
      });
      expect(diagnostics[0].message).toContain('top_level');
      expect(diagnostics[0].message).toContain('boolean');
    });

    it('should pass validation for valid visibility_parent with absolute path', () => {
      const content = `[gd_scene format=3]

[node name="ParentNode" type="Node3D"]

[node name="ValidNode" type="Node3D"]
visibility_parent = NodePath("ParentNode")
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    it('should pass validation for empty visibility_parent', () => {
      const content = `[gd_scene format=3]

[node name="ValidNode" type="Node3D"]
visibility_parent = NodePath("")
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    it('should detect invalid visibility_parent format', () => {
      const content = `[gd_scene format=3]

[node name="InvalidVisibilityParent" type="Node3D"]
visibility_parent = "../ParentNode"
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0]).toMatchObject({
        severity: 'error',
        ruleName: 'strict-parser',
      });
      expect(diagnostics[0].message).toContain('visibility_parent');
      expect(diagnostics[0].message).toContain('NodePath');
    });
  });

  describe('Strict Parser Validation - Global Properties', () => {
    it('should pass validation for valid global_position', () => {
      const content = `[gd_scene format=3]

[node name="ValidNode" type="Node3D"]
global_position = Vector3(10, 20, 30)
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    it('should pass validation for valid global_rotation', () => {
      const content = `[gd_scene format=3]

[node name="ValidNode" type="Node3D"]
global_rotation = Vector3(0, 1.5708, 0)
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    it('should pass validation for valid global_rotation_degrees', () => {
      const content = `[gd_scene format=3]

[node name="ValidNode" type="Node3D"]
global_rotation_degrees = Vector3(0, 90, 0)
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    it('should pass validation for valid global_basis', () => {
      const content = `[gd_scene format=3]

[node name="ValidNode" type="Node3D"]
global_basis = Basis(1, 0, 0, 0, 1, 0, 0, 0, 1)
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });
  });

  describe('Semantic Validation - Visibility Parent References', () => {
    it('should pass when visibility_parent node exists', () => {
      const content = `[gd_scene format=3]

[node name="ParentNode" type="Node3D"]

[node name="ChildNode" type="Node3D" parent="ParentNode"]
visibility_parent = NodePath("ParentNode")
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    it('should detect missing visibility_parent node', () => {
      const content = `[gd_scene format=3]

[node name="ChildNode" type="Node3D"]
visibility_parent = NodePath("NonExistentNode")
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics.length).toBeGreaterThan(0);
      const visibilityError = diagnostics.find(d => d.ruleName === 'valid-node3d-visibility');
      expect(visibilityError).toBeDefined();
      expect(visibilityError?.severity).toBe('error');
      expect(visibilityError?.message).toContain('not found');
    });

    it('should pass when visibility_parent is empty', () => {
      const content = `[gd_scene format=3]

[node name="ChildNode" type="Node3D"]
visibility_parent = NodePath("")
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    it('should warn about relative visibility_parent paths', () => {
      const content = `[gd_scene format=3]

[node name="ParentNode" type="Node3D"]

[node name="ChildNode" type="Node3D" parent="ParentNode"]
visibility_parent = NodePath("../OtherNode")
`;

      const diagnostics = linter.lint(content);
      const visibilityWarning = diagnostics.find(d => d.ruleName === 'valid-node3d-visibility');
      if (visibilityWarning) {
        expect(visibilityWarning.severity).toBe('warning');
        expect(visibilityWarning.message).toContain('Relative');
      }
    });
  });

  describe('Combined Properties Validation', () => {
    it('should pass validation for node with multiple valid properties', () => {
      const content = `[gd_scene format=3]

[node name="ComplexNode" type="Node3D"]
position = Vector3(1, 2, 3)
rotation_degrees = Vector3(0, 90, 0)
scale = Vector3(2, 2, 2)
visible = true
top_level = false
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    it('should detect multiple errors in a single node', () => {
      const content = `[gd_scene format=3]

[node name="ErrorNode" type="Node3D"]
position = Vector3(1, 2)
scale = Vector3(0, 1, 1)
visible = maybe
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics.length).toBeGreaterThanOrEqual(3);
      expect(diagnostics.some(d => d.message.includes('position'))).toBe(true);
      expect(diagnostics.some(d => d.message.includes('scale'))).toBe(true);
      expect(diagnostics.some(d => d.message.includes('visible'))).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle nodes without any transform properties', () => {
      const content = `[gd_scene format=3]

[node name="MinimalNode" type="Node3D"]
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    it('should handle very small valid scale values', () => {
      const content = `[gd_scene format=3]

[node name="SmallScale" type="Node3D"]
scale = Vector3(0.01, 0.01, 0.01)
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    it('should handle very large valid scale values', () => {
      const content = `[gd_scene format=3]

[node name="LargeScale" type="Node3D"]
scale = Vector3(100, 100, 100)
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    it('should handle Node3D properties on subclasses (e.g., MeshInstance3D)', () => {
      const content = `[gd_scene format=3]

[sub_resource type="BoxMesh" id="mesh_1"]

[node name="MeshNode" type="Node3D"]
position = Vector3(1, 2, 3)
scale = Vector3(0, 1, 1)
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics.length).toBeGreaterThan(0);
      // Should catch the zero scale error
      expect(diagnostics.some(d => d.message.includes('scale'))).toBe(true);
    });
  });
});
