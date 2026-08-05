/**
 * Tests for MeshInstance3D linter (strict parser + semantic rules)
 */

import { describe, it, expect } from 'vitest';
import {
  node,
  scene,
  lint,
  expectClean,
  expectDiagnostic,
  expectNoDiagnostic,
  runPropertyValidation,
} from '../../../linter/testing/testkit';
import './linterParser';
import './linter';

describe('MeshInstance3D Linter', () => {
  describe('Strict Parser Validation (Format)', () => {
    it('should pass validation for valid MeshInstance3D properties', () => {
      expectClean(
        scene(
          '[sub_resource type="BoxMesh" id="mesh_1"]',
          '[sub_resource type="StandardMaterial3D" id="mat_1"]',
          node(
            'MeshInstance3D',
            {
              cast_shadow: 1,
              mesh: 'SubResource("mesh_1")',
              'surface_material_override/0': 'SubResource("mat_1")',
            },
            { name: 'ValidMesh' }
          )
        )
      );
    });

    describe('cast_shadow validation', () => {
      it('should detect invalid cast_shadow value', () => {
        const diagnostics = lint(
          scene(node('MeshInstance3D', { cast_shadow: 99 }, { name: 'InvalidShadow' }))
        );
        expect(diagnostics).toHaveLength(1);
        expect(diagnostics[0]).toMatchObject({
          severity: 'error',
          ruleName: 'strict-parser',
        });
        expect(diagnostics[0]!.message).toContain('cast_shadow');
        expect(diagnostics[0]!.message).toContain('0-3');
      });

      it('should validate all valid cast_shadow values', () => {
        for (const value of [0, 1, 2, 3]) {
          expectClean(scene(node('MeshInstance3D', { cast_shadow: value })));
        }
      });

      it('should reject negative cast_shadow value', () => {
        expectDiagnostic(
          scene(node('MeshInstance3D', { cast_shadow: -1 }, { name: 'NegativeShadow' })),
          { prop: 'cast_shadow', contains: ['cast_shadow'] }
        );
      });
    });

    runPropertyValidation({ nodeType: 'MeshInstance3D' }, [
      { prop: 'gi_mode', valid: [0, 1, 2], invalid: [{ value: 5, contains: ['0-2'] }] },
      { prop: 'gi_lightmap_scale', valid: [0, 1, 2, 3], invalid: [{ value: 10, contains: ['0-3'] }] },
      {
        prop: 'visibility_range_begin',
        valid: ['10.5'],
        invalid: [{ value: '-5.0', contains: ['non-negative'] }],
      },
      {
        prop: 'visibility_range_end',
        valid: ['100.0'],
        invalid: [{ value: '-10.0', contains: ['non-negative'] }],
      },
      {
        prop: 'visibility_range_begin_margin',
        valid: ['2.5'],
        invalid: [{ value: '-1.0', contains: ['non-negative'] }],
      },
      {
        prop: 'visibility_range_end_margin',
        valid: ['5.0'],
        invalid: [{ value: '-3.0', contains: ['non-negative'] }],
      },
      {
        prop: 'visibility_range_fade_mode',
        valid: [0, 1, 2],
        invalid: [{ value: 5, contains: ['0-2'] }],
      },
      {
          prop: 'layers',
          valid: [1, 1048575, 0, 2000000, 2147483648, 4294967295],
          invalid: [

          ],
        },
    ]);

    describe('material resource reference validation', () => {
      it('should accept valid material_override format', () => {
        expectClean(
          scene(
            '[sub_resource type="StandardMaterial3D" id="mat_1"]',
            node('MeshInstance3D', { material_override: 'SubResource("mat_1")' }, { name: 'ValidMaterial' })
          )
        );
      });

      it('should reject invalid material_override format', () => {
        expectDiagnostic(
          scene(node('MeshInstance3D', { material_override: '"invalid_format"' }, { name: 'InvalidMaterial' })),
          { prop: 'material_override', contains: ['resource reference'] }
        );
      });

      it('should accept valid material_overlay format', () => {
        expectClean(
          scene(
            '[sub_resource type="StandardMaterial3D" id="mat_overlay"]',
            node('MeshInstance3D', { material_overlay: 'SubResource("mat_overlay")' }, { name: 'ValidOverlay' })
          )
        );
      });

      it('should reject invalid material_overlay format', () => {
        expectDiagnostic(
          scene(node('MeshInstance3D', { material_overlay: 'invalid' }, { name: 'InvalidOverlay' })),
          { prop: 'material_overlay', contains: ['resource reference'] }
        );
      });
    });

    it('should detect invalid transform format', () => {
      const diagnostics = lint(
        scene(node('MeshInstance3D', { transform: 'Transform3D(1, 0, 0)' }, { name: 'InvalidTransform' }))
      );
      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0]).toMatchObject({
        severity: 'error',
        ruleName: 'strict-parser',
      });
      expect(diagnostics[0]!.message).toContain('transform');
    });
  });

  describe('Semantic Validation (Resource References)', () => {
    it('should detect missing mesh resource', () => {
      const diagnostics = lint(
        scene(node('MeshInstance3D', { mesh: 'SubResource("nonexistent")' }, { name: 'MissingMesh' }))
      );
      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0]).toMatchObject({
        severity: 'error',
        nodeName: 'MissingMesh',
        nodeType: 'MeshInstance3D',
        ruleName: 'valid-meshinstance3d-resources',
      });
      expect(diagnostics[0]!.message).toContain('Mesh resource not found');
    });

    it('should pass when all resources exist', () => {
      expectClean(
        scene(
          '[sub_resource type="BoxMesh" id="mesh_1"]',
          node('MeshInstance3D', { mesh: 'SubResource("mesh_1")' }, { name: 'ValidMesh' })
        )
      );
    });

    it('should detect missing material_override resource', () => {
      expectDiagnostic(
        scene(
          node('MeshInstance3D', { material_override: 'SubResource("nonexistent_material")' }, { name: 'MissingMaterial' })
        ),
        { prop: 'Material override resource not found', contains: ['Material override resource not found'] }
      );
    });

    it('should detect missing material_overlay resource', () => {
      expectDiagnostic(
        scene(
          node('MeshInstance3D', { material_overlay: 'SubResource("nonexistent_overlay")' }, { name: 'MissingOverlay' })
        ),
        { prop: 'Material overlay resource not found', contains: ['Material overlay resource not found'] }
      );
    });

    it('should detect missing skin resource', () => {
      const diagnostics = lint(
        scene(node('MeshInstance3D', { skin: 'SubResource("nonexistent_skin")' }, { name: 'MissingSkin' }))
      );
      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0]!.message).toContain('Skin resource not found');
    });

    it('should detect missing surface material override resource', () => {
      expectDiagnostic(
        scene(
          node(
            'MeshInstance3D',
            { 'surface_material_override/0': 'SubResource("nonexistent_surface")' },
            { name: 'MissingSurfaceMat' }
          )
        ),
        {
          prop: 'Surface material override resource not found',
          contains: ['Surface material override resource not found'],
        }
      );
    });
  });

  describe('Semantic Validation (Visibility Range)', () => {
    it('should detect invalid visibility range (begin > end)', () => {
      expectDiagnostic(
        scene(
          node(
            'MeshInstance3D',
            { visibility_range_begin: '100.0', visibility_range_end: '50.0' },
            { name: 'InvalidRange' }
          )
        ),
        {
          ruleName: 'valid-meshinstance3d-visibility-range',
          severity: 'error',
          contains: ['begin', 'end'],
        }
      );
    });

    it('should accept valid visibility range (begin < end)', () => {
      expectClean(
        scene(
          node(
            'MeshInstance3D',
            { visibility_range_begin: '10.0', visibility_range_end: '100.0' },
            { name: 'ValidRange' }
          )
        )
      );
    });

    it('should accept valid visibility range (begin = end)', () => {
      expectClean(
        scene(
          node(
            'MeshInstance3D',
            { visibility_range_begin: '50.0', visibility_range_end: '50.0' },
            { name: 'EqualRange' }
          )
        )
      );
    });

    it('should not validate range when only begin is specified', () => {
      expectClean(
        scene(node('MeshInstance3D', { visibility_range_begin: '100.0' }, { name: 'OnlyBegin' }))
      );
    });

    it('should not validate range when only end is specified', () => {
      expectClean(
        scene(node('MeshInstance3D', { visibility_range_end: '50.0' }, { name: 'OnlyEnd' }))
      );
    });
  });

  describe('Semantic Validation (Skeleton)', () => {
    it('should detect missing skeleton node', () => {
      const diagnostics = lint(
        scene(node('MeshInstance3D', { skeleton: 'NodePath("NonexistentSkeleton")' }, { name: 'MissingSkeleton' }))
      );
      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0]).toMatchObject({
        severity: 'error',
        ruleName: 'valid-meshinstance3d-skeleton',
      });
      expect(diagnostics[0]!.message).toContain('Skeleton node not found');
    });

    it('should pass when skeleton node exists', () => {
      expectClean(
        scene(
          node('Skeleton3D', {}, { name: 'MySkeleton' }),
          node('MeshInstance3D', { skeleton: 'NodePath("MySkeleton")' }, { name: 'MyMesh' })
        )
      );
    });

    it('should detect skeleton pointing to wrong node type', () => {
      expectDiagnostic(
        scene(
          node('Node3D', {}, { name: 'Root' }),
          node('Node3D', {}, { name: 'NotASkeleton', parent: '.' }),
          node('MeshInstance3D', { skeleton: 'NodePath("NotASkeleton")' }, { name: 'MyMesh', parent: '.' })
        ),
        { prop: 'must point to a Skeleton3D node', contains: ['must point to a Skeleton3D node'] }
      );
    });

    it('should accept empty skeleton path', () => {
      expectClean(
        scene(node('MeshInstance3D', { skeleton: 'NodePath("")' }, { name: 'MyMesh' }))
      );
    });

    it('should not error on a relative (..) skeleton path that escapes the authored scope', () => {
      // Mirrors scenes/demos/3d/graphics_settings/3d_scene.tscn: a MeshInstance3D
      // whose skeleton resolves up the tree via "../.." — a relative path the
      // static linter cannot resolve, so it must not assert not-found.
      expectNoDiagnostic(
        scene(
          node('Node3D', {}, { name: 'Root' }),
          node('SpotLight3D', {}, { name: 'SpotLight3D', parent: '.' }),
          node('MeshInstance3D', { skeleton: 'NodePath("../..")' }, { name: 'MeshInstance3D', parent: 'SpotLight3D' })
        ),
        { ruleName: 'valid-meshinstance3d-skeleton' }
      );
    });

    it('should not error when the MeshInstance3D is parented under an instanced sub-scene', () => {
      // Mirrors the fabrik_ik GLB case: a mesh living inside an instanced
      // sub-scene references a Skeleton3D that exists only in that sub-scene's
      // internals, which the static linter cannot see.
      const content = `[gd_scene format=3]

[ext_resource type="PackedScene" path="res://character.tscn" id="1_char"]

[node name="Root" type="Node3D"]

[node name="Character" parent="." instance=ExtResource("1_char")]

[node name="BodyMesh" type="MeshInstance3D" parent="Character"]
skeleton = NodePath("Armature/Skeleton3D")
`;

      expectNoDiagnostic(content, { ruleName: 'valid-meshinstance3d-skeleton' });
    });

    it('should still error on a missing local skeleton when nested under a non-instance parent', () => {
      // Boundary: a non-relative path under an ordinary (non-instanced) parent is
      // fully authored, so a genuinely missing Skeleton3D must still be reported.
      expectDiagnostic(
        scene(
          node('Node3D', {}, { name: 'Root' }),
          node('Node3D', {}, { name: 'Holder', parent: '.' }),
          node('MeshInstance3D', { skeleton: 'NodePath("NonexistentSkeleton")' }, { name: 'MyMesh', parent: 'Holder' })
        ),
        { ruleName: 'valid-meshinstance3d-skeleton', severity: 'error', contains: ['Skeleton node not found'] }
      );
    });
  });

  describe('Semantic Validation (Surface Index Range)', () => {
    it('should warn about unusually high surface index but accept it', () => {
      expectDiagnostic(
        scene(
          '[sub_resource type="StandardMaterial3D" id="mat_1"]',
          node('MeshInstance3D', { 'surface_material_override/256': 'SubResource("mat_1")' }, { name: 'ExcessiveIndex' })
        ),
        { ruleName: 'valid-meshinstance3d-surface-index', severity: 'warning', contains: ['unusually high'] }
      );
    });

    it('should accept surface index 0 (lower boundary)', () => {
      expectClean(
        scene(
          '[sub_resource type="StandardMaterial3D" id="mat_1"]',
          node('MeshInstance3D', { 'surface_material_override/0': 'SubResource("mat_1")' }, { name: 'ValidIndex0' })
        )
      );
    });

    it('should accept surface index within threshold (no warnings)', () => {
      expectClean(
        scene(
          '[sub_resource type="StandardMaterial3D" id="mat_1"]',
          node('MeshInstance3D', { 'surface_material_override/31': 'SubResource("mat_1")' }, { name: 'ValidIndex31' })
        )
      );
    });

    it('should warn about high index and check resource existence', () => {
      const diagnostics = lint(
        scene(
          node(
            'MeshInstance3D',
            { 'surface_material_override/999': 'SubResource("nonexistent")' },
            { name: 'HighIndexMissingResource' }
          )
        )
      );
      expect(diagnostics.length).toBeGreaterThan(0);
      // Should warn about high index
      const indexWarning = diagnostics.find(d => d.ruleName === 'valid-meshinstance3d-surface-index');
      expect(indexWarning).toBeDefined();
      expect(indexWarning?.severity).toBe('warning');
      expect(indexWarning?.message).toContain('unusually high');

      // Should also report resource not found
      const resourceError = diagnostics.find(d => d.message.includes('resource not found'));
      expect(resourceError).toBeDefined();
      expect(resourceError?.severity).toBe('error');
    });
  });

  describe('Edge Cases', () => {
    it('should handle multiple validation errors', () => {
      const diagnostics = lint(
        scene(
          node(
            'MeshInstance3D',
            {
              cast_shadow: 10,
              gi_mode: 5,
              mesh: 'SubResource("nonexistent")',
              visibility_range_begin: '100.0',
              visibility_range_end: '50.0',
            },
            { name: 'MultipleErrors' }
          )
        )
      );
      // We expect multiple errors: cast_shadow, gi_mode format errors
      // plus potentially mesh resource not found and visibility range error
      expect(diagnostics.length).toBeGreaterThan(1);
      // Verify at least some of the expected errors are present
      const hasCastShadowError = diagnostics.some(d => d.message.includes('cast_shadow'));
      const hasGiModeError = diagnostics.some(d => d.message.includes('gi_mode'));
      expect(hasCastShadowError || hasGiModeError).toBe(true);
    });

    it('should handle all properties together', () => {
      const content = `[gd_scene format=3]

[sub_resource type="BoxMesh" id="mesh_1"]
[sub_resource type="StandardMaterial3D" id="mat_1"]
[sub_resource type="StandardMaterial3D" id="mat_2"]
[sub_resource type="Skin" id="skin_1"]

[node name="MySkeleton" type="Skeleton3D"]

[node name="ComplexMesh" type="MeshInstance3D"]
mesh = SubResource("mesh_1")
material_override = SubResource("mat_1")
material_overlay = SubResource("mat_2")
surface_material_override/0 = SubResource("mat_1")
skin = SubResource("skin_1")
skeleton = NodePath("MySkeleton")
cast_shadow = 2
gi_mode = 1
gi_lightmap_scale = 2
visibility_range_begin = 10.0
visibility_range_begin_margin = 2.0
visibility_range_end = 100.0
visibility_range_end_margin = 5.0
visibility_range_fade_mode = 1
layers = 1023
`;

      expectClean(content);
    });

    it('should handle node with no properties', () => {
      expectClean(scene(node('MeshInstance3D', {}, { name: 'EmptyMesh' })));
    });
  });
});
