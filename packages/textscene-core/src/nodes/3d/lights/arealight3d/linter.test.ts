/**
 * AreaLight3D linting: strict validators and the projector configuration warning. The
 * `light_energy` band is the inherited Light3D validator's bound (light_3d.cpp:389).
 */

import { describe, it, expect } from 'vitest';
import {
  scene,
  node,
  lint,
  expectClean,
  expectDiagnostic,
  expectNoDiagnostic,
  expectNoErrors,
  runPropertyValidation,
} from '../../../../linter/testing/testkit';
import './linterParser';
import './linter';
import { errorsOf, warningsOf } from '../../../../linter/testing/tierLists';

/** The textures an `area_texture` accept case references, so the reference resolves. */
const textures = [
  '[ext_resource type="Texture2D" path="res://panel.png" id="1_panel"]',
  '[sub_resource type="GradientTexture2D" id="GradientTexture2D_a"]',
].join('\n\n');

describe('AreaLight3D Linter', () => {
  describe('Strict Parser Validation (Format)', () => {
    it('should pass validation for valid AreaLight3D properties', () => {
      expectClean(
        scene(
          node('AreaLight3D', {
            light_energy: 4.0,
            light_color: 'Color(0.5, 0.6, 0.7, 1)',
            shadow_enabled: true,
            area_range: 2.0,
            area_size: 'Vector2(2, 1)',
          })
        )
      );
    });

    runPropertyValidation({ nodeType: 'AreaLight3D', acceptChild: textures }, [
      {
        // light_3d.cpp:389 hints "0,16,0.001,or_greater" and Light3D::set_param:36
        // guards the param index, not the value, so a negative energy warns.
        prop: 'light_energy',
        valid: [2.5, 0],
        invalid: [
          { value: 'invalid', contains: ['must be a number'] },
          { value: -1.0, contains: ['non-negative'], severity: 'warning' },
        ],
      },
      {
        prop: 'light_color',
        valid: ['Color(0.95, 0.9, 0.85, 1)'],
        invalid: [{ value: 'RGB(1, 1, 1)', contains: ['Color'] }, { value: 'Color(1, 1, 1)' }],
      },
      {
        prop: 'shadow_enabled',
        valid: [true, false],
        invalid: [{ value: 'yes', contains: ['boolean'] }],
      },
      {
        // 4.7.2: light_3d.cpp:764 hints "0,4096,0.001,or_greater" and Light3D::set_param:41
        // stores any value, so only a negative is out of band, and it warns.
        prop: 'area_range',
        valid: [2.0, 0, 5000],
        invalid: [
          { value: 'invalid', contains: ['must be a number'] },
          { value: -5.0, contains: ['non-negative'], severity: 'warning' },
        ],
      },
      {
        // 4.7.2: light_3d.cpp:765 hints "-10,10,0.001,or_greater,or_less": both ends open.
        prop: 'area_attenuation',
        valid: [1.0, 2.0, -3.5, 25, 'inf'],
        invalid: [{ value: 'steep', contains: ['must be a number'] }],
      },
      {
        // 4.7.2: light_3d.cpp:724 clamps a negative axis to 0, so it errors.
        prop: 'area_size',
        valid: ['Vector2(2, 1)', 'Vector2(0, 0)'],
        invalid: [
          { value: 'Vector2(2)', contains: ['Vector2'] },
          { value: 'invalid' },
          { value: 'Vector2(-2, 1)', contains: ['>= 0'], severity: 'error' },
        ],
      },
      {
        prop: 'area_texture',
        valid: ['ExtResource("1_panel")', 'SubResource("GradientTexture2D_a")', 'null'],
        invalid: [{ value: 'panel.png' }],
      },
      {
        prop: 'shadow_bias',
        valid: [0.1],
        invalid: [{ value: 'abc', contains: ['must be a number'] }],
      },
      {
        prop: 'shadow_normal_bias',
        valid: [2.0],
      },
    ]);

    it('should accept zero light_energy', () => {
      expectClean(scene(node('AreaLight3D', { light_energy: 0, area_range: 2.0 })));
    });
  });

  describe('Semantic Validation', () => {
    // light_3d.cpp:389: light_energy PROPERTY_HINT_RANGE "0,16,0.001,or_greater".
    // `or_greater` opens the high end, so only a negative is out of band, and
    // the inherited Light3D validator reports it.
    describe('light energy warnings', () => {
      it('warns rather than errors on negative light_energy', () => {
        const diagnostics = lint(scene(node('AreaLight3D', { light_energy: -0.005, area_range: 2.0 })));
        expect(warningsOf(diagnostics).some((d) => d.message.includes('light_energy'))).toBe(true);
        expect(errorsOf(diagnostics)).toEqual([]);
      });

      it.each([0, 0.005, 1.5, 150])('says nothing about light_energy %s', (energy) => {
        const diagnostics = lint(scene(node('AreaLight3D', { light_energy: energy, area_range: 2.0 })));
        expect(warningsOf(diagnostics)).toEqual([]);
      });
    });

    it('should handle node with no properties', () => {
      expectClean(scene(node('AreaLight3D')));
    });

    it('should handle shadow_enabled = true without errors', () => {
      expectNoErrors(scene(node('AreaLight3D', { shadow_enabled: true })));
    });
  });

  // 4.7.2 light_3d.cpp:774-776. The inspector hides `light_projector` on an area light
  // (:345-346), but Godot still loads one a hand-written scene sets.
  describe('projector on an area light', () => {
    const rule = { ruleName: 'arealight3d-projector-unsupported' };

    it('warns when light_projector is set', () => {
      expectDiagnostic(scene(node('AreaLight3D', { light_projector: 'ExtResource("1_proj")' })), {
        ...rule,
        severity: 'warning',
      });
    });

    it('warns when light_projector is set with shadows on (edge case)', () => {
      expectDiagnostic(
        scene(node('AreaLight3D', { light_projector: 'ExtResource("1_proj")', shadow_enabled: true })),
        { ...rule, severity: 'warning' }
      );
    });

    it('does not warn when light_projector is absent', () => {
      expectNoDiagnostic(scene(node('AreaLight3D', { area_size: 'Vector2(2, 1)' })), rule);
    });

    it('does not warn when light_projector is malformed (error case)', () => {
      // The format validator already errors on it, and Godot sets no projector from a value its reader rejects.
      expectNoDiagnostic(scene(node('AreaLight3D', { light_projector: 'not-a-reference' })), rule);
    });
  });
});
