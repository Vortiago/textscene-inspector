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
      it('should detect an invalid cast_shadow value as a warning', () => {
        // visual_instance_3d.cpp:601 hints the enum but set_cast_shadows_setting
        // (:366-370) is a bare assignment, so out-of-range is a warning, not an
        // error (ADR-0032).
        const diagnostics = lint(
          scene(node('MeshInstance3D', { cast_shadow: 99 }, { name: 'InvalidShadow' }))
        );
        expect(diagnostics).toHaveLength(1);
        expect(diagnostics[0]).toMatchObject({
          severity: 'warning',
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
      // `gi_lightmap_scale` had a validator here until GeometryInstance3D took
      // over this family. It is deprecated and bound PROPERTY_USAGE_NONE
      // (scene/3d/visual_instance_3d.cpp), so Godot never writes it to a .tscn
      // and nothing could ever have reached that check. The parser still reads
      // the key so an older hand-written scene carrying it still loads.
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

    it('reports nothing for a cleared mesh slot', () => {
      // `mesh = null` is an emptied slot, not a dangling reference: Godot writes
      // it and reloads it, so reporting a missing resource is a false error.
      const content = scene(node('MeshInstance3D', { mesh: 'null' }, { name: 'ClearedMesh' }));
      expectNoDiagnostic(content, { ruleName: 'valid-meshinstance3d-resources' });
      expectClean(content);
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

    // `_set` reads a FIXED slice for the index — `get_slicec('/', 1)`
    // (mesh_instance_3d.cpp:66) — and `get_slicec` returns that slice alone
    // (ustring.cpp:941-964), so the override lands on surface 0 and its
    // reference is as dangling as any other.
    it('follows a trailing segment to the surface Godot writes', () => {
      expectDiagnostic(
        scene(
          node(
            'MeshInstance3D',
            { 'surface_material_override/0/extra': 'SubResource("nonexistent_surface")' },
            { name: 'TrailingSurfaceMat' }
          )
        ),
        {
          prop: 'Surface material override resource not found',
          contains: ['for surface 0'],
        }
      );
    });
  });

  // The real condition (visual_instance_3d.cpp: `!is_zero_approx(end) && end <=
  // begin`) belongs to `valid-geometryinstance3d-visibility-range`, which
  // reaches MeshInstance3D through its descendsFrom matcher. This slice reports
  // nothing of its own.
  describe('Semantic Validation (Visibility Range)', () => {
    it('reports nothing for any begin/end pairing', () => {
      const cases: Record<string, string>[] = [
        { visibility_range_begin: '100.0', visibility_range_end: '50.0' },
        { visibility_range_begin: '10.0', visibility_range_end: '100.0' },
        { visibility_range_begin: '50.0', visibility_range_end: '50.0' },
        { visibility_range_begin: '100.0' },
        { visibility_range_end: '50.0' },
      ];
      for (const range of cases) {
        expectClean(scene(node('MeshInstance3D', range, { name: 'Range' })));
      }
    });
  });

  // Godot tolerates a stale or wrong-typed skeleton path: the lookup is
  // get_node_or_null (its in-source comment notes the path may be outdated
  // after a reparent) and a non-Skeleton3D target silently yields no skin.
  describe('Semantic Validation (Skeleton)', () => {
    it('reports nothing for a missing, wrong-typed, empty or relative skeleton path', () => {
      expectClean(
        scene(node('MeshInstance3D', { skeleton: 'NodePath("NonexistentSkeleton")' }, { name: 'MissingSkeleton' }))
      );
      expectClean(
        scene(
          node('Skeleton3D', {}, { name: 'MySkeleton' }),
          node('MeshInstance3D', { skeleton: 'NodePath("MySkeleton")' }, { name: 'MyMesh' })
        )
      );
      expectClean(
        scene(
          node('Node3D', {}, { name: 'Root' }),
          node('Node3D', {}, { name: 'NotASkeleton', parent: '.' }),
          node('MeshInstance3D', { skeleton: 'NodePath("NotASkeleton")' }, { name: 'MyMesh', parent: '.' })
        )
      );
      expectClean(scene(node('MeshInstance3D', { skeleton: 'NodePath("")' }, { name: 'MyMesh' })));
      expectClean(
        scene(
          node('Node3D', {}, { name: 'Root' }),
          node('SpotLight3D', {}, { name: 'SpotLight3D', parent: '.' }),
          node('MeshInstance3D', { skeleton: 'NodePath("../..")' }, { name: 'MeshInstance3D', parent: 'SpotLight3D' })
        )
      );
    });
  });

  // mesh_instance_3d.cpp:367 bounds the surface index with
  // ERR_FAIL_INDEX(p_surface, surface_override_materials.size()) — the mesh's own
  // surface count, which a .tscn does not state — so no fixed index is out of range.
  describe('Semantic Validation (Surface Index Range)', () => {
    it.each([0, 31, 256, 999])('accepts surface index %s', (index) => {
      expectClean(
        scene(
          '[sub_resource type="StandardMaterial3D" id="mat_1"]',
          node('MeshInstance3D', { [`surface_material_override/${index}`]: 'SubResource("mat_1")' }, { name: 'AnyIndex' })
        )
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

    it('should check resource existence at any index', () => {
      const diagnostics = lint(
        scene(
          node(
            'MeshInstance3D',
            { 'surface_material_override/999': 'SubResource("nonexistent")' },
            { name: 'HighIndexMissingResource' }
          )
        )
      );
      // The missing resource is the only complaint: the index itself is unbounded.
      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0]?.severity).toBe('error');
      expect(diagnostics[0]?.message).toContain('resource not found');
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
            },
            { name: 'MultipleErrors' }
          )
        )
      );
      // We expect multiple diagnostics: cast_shadow and gi_mode format
      // complaints plus the missing mesh resource.
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

describe('MeshInstance3D surface-override index grammar', () => {
  it('checks an override written under a non-numeric index, which _set resolves', () => {
    // `_set` reads the index with a bare
    // `p_name.get_slicec('/', 1).to_int()` and no validity gate
    // (mesh_instance_3d.cpp:66), and `to_int` skips a character it cannot use
    // rather than stopping at it (ustring.cpp:2280-2293), so
    // `surface_material_override/x1` overrides surface 1 and its dangling
    // reference is a real one.
    expectDiagnostic(
      scene(node('MeshInstance3D', { 'surface_material_override/x1': 'SubResource("mat_missing")' })),
      { ruleName: 'valid-meshinstance3d-resources', severity: 'error', contains: ['surface 1'] }
    );
  });
});
