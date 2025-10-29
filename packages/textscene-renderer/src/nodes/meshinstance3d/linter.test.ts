/**
 * Tests for MeshInstance3D linter (strict parser + semantic rules)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Linter } from '../../linter/Linter';
import './linterParser'; // Import to trigger validator registration
import './linter'; // Import to trigger rule registration

describe('MeshInstance3D Linter', () => {
  let linter: Linter;

  beforeEach(() => {
    linter = new Linter();
  });

  describe('Strict Parser Validation (Format)', () => {
    it('should pass validation for valid MeshInstance3D properties', () => {
      const content = `[gd_scene format=3]

[sub_resource type="BoxMesh" id="mesh_1"]

[sub_resource type="StandardMaterial3D" id="mat_1"]

[node name="ValidMesh" type="MeshInstance3D"]
cast_shadow = 1
mesh = SubResource("mesh_1")
surface_material_override/0 = SubResource("mat_1")
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    it('should detect invalid cast_shadow value', () => {
      const content = `[gd_scene format=3]

[node name="InvalidShadow" type="MeshInstance3D"]
cast_shadow = 99
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0]).toMatchObject({
        severity: 'error',
        ruleName: 'strict-parser',
      });
      expect(diagnostics[0].message).toContain('cast_shadow');
      expect(diagnostics[0].message).toContain('0-3');
    });

    it('should detect invalid transform format', () => {
      const content = `[gd_scene format=3]

[node name="InvalidTransform" type="MeshInstance3D"]
transform = Transform3D(1, 0, 0)
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0]).toMatchObject({
        severity: 'error',
        ruleName: 'strict-parser',
      });
      expect(diagnostics[0].message).toContain('transform');
    });

    it('should validate all valid cast_shadow values', () => {
      const validValues = [0, 1, 2, 3]; // OFF, ON, DOUBLE_SIDED, SHADOWS_ONLY

      for (const value of validValues) {
        const content = `[gd_scene format=3]

[node name="ValidShadow${value}" type="MeshInstance3D"]
cast_shadow = ${value}
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      }
    });
  });

  describe('Semantic Validation (Resource References)', () => {
    it('should detect missing mesh resource', () => {
      const content = `[gd_scene format=3]

[node name="MissingMesh" type="MeshInstance3D"]
mesh = SubResource("nonexistent")
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0]).toMatchObject({
        severity: 'error',
        nodeName: 'MissingMesh',
        nodeType: 'MeshInstance3D',
        ruleName: 'valid-meshinstance3d-resources',
      });
      expect(diagnostics[0].message).toContain('Mesh resource not found');
    });

    it('should pass when all resources exist', () => {
      const content = `[gd_scene format=3]

[sub_resource type="BoxMesh" id="mesh_1"]

[node name="ValidMesh" type="MeshInstance3D"]
mesh = SubResource("mesh_1")
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });
  });
});
