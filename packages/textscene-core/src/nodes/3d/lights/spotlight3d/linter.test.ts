/** SpotLight3D linting: strict validators and semantic rules. */

import { describe, it, expect } from 'vitest';
import {
  node,
  scene,
  lint,
  expectClean,
  expectDiagnostic,
  expectNoDiagnostic,
  expectNoErrors,
  runPropertyValidation,
} from '../../../../linter/testing/testkit';
import './linterParser';
import './linter';

describe('SpotLight3D Linter', () => {
  describe('Strict Parser Validation (Format)', () => {
    it('should pass validation for valid SpotLight3D properties', () => {
      expectClean(
        scene(
          node('SpotLight3D', {
            light_energy: 1.0,
            light_color: 'Color(1, 1, 1, 1)',
            spot_range: 10.0,
            spot_angle: 45.0,
            spot_attenuation: 1.0,
            spot_angle_attenuation: 1.0,
            shadow_enabled: true,
          })
        )
      );
    });

    it('should accept zero light_energy', () => {
      expectClean(scene(node('SpotLight3D', { light_energy: 0 })));
    });

    it('should accept zero spot_attenuation', () => {
      expectNoErrors(scene(node('SpotLight3D', { spot_attenuation: 0 })));
    });

    it('should accept zero spot_angle_attenuation', () => {
      expectNoErrors(scene(node('SpotLight3D', { spot_angle_attenuation: 0 })));
    });

    runPropertyValidation({ nodeType: 'SpotLight3D' }, [
      {
        // light_3d.cpp:389 hints "0,16,0.001,or_greater" and Light3D::set_param:36
        // guards the param index, not the value, so a negative energy warns. 0 is
        // the hint's floor, 150 is above its open ceiling.
        prop: 'light_energy',
        valid: [2.5, 0, 150],
        invalid: [
          { value: 'invalid', contains: ['must be a number'] },
          { value: -1.0, contains: ['non-negative'], severity: 'warning' },
        ],
      },
      {
        // light_3d.cpp:673 hints "-10,10,0.01,or_greater,or_less": the range
        // starts below zero and both ends are soft, so a negative is a legal
        // inverse falloff.
        prop: 'spot_attenuation',
        valid: [1.5, 0, -0.5, -2],
        acceptMode: 'no-error',
        invalid: [{ value: 'abc', contains: ['must be a number'] }],
      },
      {
        // light_3d.cpp:675 declares it PROPERTY_HINT_EXP_EASING, which states no
        // range at all, so no value is out of band.
        prop: 'spot_angle_attenuation',
        valid: [1.5, 0, -1.0, 21.1121],
        invalid: [{ value: 'abc', contains: ['must be a number'] }],
      },
      {
        prop: 'light_color',
        valid: ['Color(0.95, 0.9, 0.85, 1)'],
        invalid: [
          { value: 'RGB(1, 1, 1)', contains: ['Color'] },
          { value: 'Color(1, 1, 1)' },
        ],
      },
      {
        prop: 'light_indirect_energy',
        valid: [1.5, 0],
        invalid: [{ value: -0.5, contains: ['non-negative'] }],
      },
      {
        prop: 'light_volumetric_fog_energy',
        valid: [2.0],
        invalid: [{ value: -1.0, contains: ['non-negative'] }],
      },
      {
        prop: 'shadow_enabled',
        valid: [true, false],
        invalid: [{ value: 'yes', contains: ['boolean'] }],
      },
      { prop: 'light_negative', valid: [true] },
      { prop: 'shadow_reverse_cull_face', valid: [false] },
      {
        prop: 'shadow_bias',
        valid: [0.1],
        invalid: [{ value: 'abc', contains: ['must be a number'] }],
      },
      { prop: 'shadow_normal_bias', valid: [2.0] },
      {
        prop: 'shadow_blur',
        valid: [5.0, 0],
        invalid: [{ value: -1.0, contains: ['between 0 and 10'] }],
      },
      {
        // light_3d.cpp:406 hints "-16,16,0.001" (both ends closed), warning-only
        // since set_param:36 only guards the param index.
        prop: 'shadow_transmittance_bias',
        valid: [-16, -5, 0, 5, 16],
        invalid: [
          { value: -17, contains: ['between -16 and 16'] },
          { value: 17, contains: ['between -16 and 16'] },
        ],
      },
      {
        prop: 'shadow_opacity',
        valid: [0, 0.5, 1],
        invalid: [
          { value: -0.1, contains: ['between 0 and 1'] },
          { value: 1.5, contains: ['between 0 and 1'] },
        ],
      },
      {
        // light_3d.cpp:397 hints "0,16,0.001,or_greater": 2.0 is a legal
        // stylised boost. Only the 0 floor is a real, warning-only bound.
        prop: 'light_specular',
        valid: [0, 0.5, 1, 2.0],
        invalid: [{ value: -1.0, contains: ['non-negative'] }],
      },
      {
        prop: 'light_bake_mode',
        valid: [0, 1, 2],
        invalid: [{ value: 5, contains: ['0-2'] }],
      },
      {
          prop: 'light_cull_mask',
          valid: [1, 100, 1048575, 0, 2000000, 2147483648, 4294967295],
          invalid: [

          ],
        },
      {
        // light_3d.cpp:672 hints "0,4096,0.001,or_greater,exp,suffix:m",
        // unenforced, so 0 is legal, 1500 is above the open ceiling, and a
        // negative only warns.
        prop: 'spot_range',
        valid: [10.0, 0, 1500],
        invalid: [
          { value: 'invalid', contains: ['must be a number'] },
          { value: -5.0, contains: ['non-negative'], severity: 'warning' },
        ],
      },
      {
        // light_3d.cpp:674 hints "0,180,0.01,degrees" (180, not 90), and
        // set_param does not enforce it, so 91-180 is in band and both closed
        // ends warn just outside.
        prop: 'spot_angle',
        valid: [0, 30, 45, 60, 90, 91, 180],
        invalid: [
          { value: 'invalid', contains: ['must be a number'] },
          { value: -5, contains: ['between 0 and 180'], severity: 'warning' },
          { value: 181, contains: ['between 0 and 180'], severity: 'warning' },
        ],
      },
    ]);
  });

  describe('Semantic Validation', () => {
    describe('missing required properties errors', () => {
      it('should not error when spot_range is missing', () => {
        expectNoErrors(scene(node('SpotLight3D', { light_energy: 1.0, spot_angle: 45.0 })), {
          prop: 'spot_range',
        });
      });

      it('should not error when spot_angle is missing', () => {
        expectNoErrors(scene(node('SpotLight3D', { light_energy: 1.0, spot_range: 5.0 })), {
          prop: 'spot_angle',
        });
      });

      it('should not error when both spot_range and spot_angle are missing', () => {
        const content = scene(node('SpotLight3D', { light_energy: 1.0 }));
        expectNoErrors(content, { prop: 'spot_range' });
        expectNoErrors(content, { prop: 'spot_angle' });
      });

      it('should not error when both spot_range and spot_angle are present', () => {
        const content = scene(node('SpotLight3D', { spot_range: 5.0, spot_angle: 45.0 }));
        expectNoErrors(content, { prop: 'spot_range' });
        expectNoErrors(content, { prop: 'spot_angle' });
      });
    });

    // light_3d.cpp:389: light_energy PROPERTY_HINT_RANGE "0,16,0.001,or_greater":
    // the high end is open, so only a negative is out of band.
    describe('light energy warnings', () => {
      it('should warn on negative light_energy', () => {
        expectDiagnostic(scene(node('SpotLight3D', { light_energy: -0.005 })), {
          prop: 'light_energy',
          severity: 'warning',
          contains: ['non-negative', '-0.005'],
        });
      });

      it.each([0, 1.5, 150])('says nothing about light_energy %s', (energy) => {
        expectNoDiagnostic(scene(node('SpotLight3D', { light_energy: energy })), {
          prop: 'light_energy',
        });
      });
    });

    // light_3d.cpp:672: spot_range PROPERTY_HINT_RANGE
    // "0,4096,0.001,or_greater,exp,suffix:m".
    describe('spot_range warnings', () => {
      it('should warn on negative spot_range', () => {
        expectDiagnostic(scene(node('SpotLight3D', { spot_range: -0.05 })), {
          prop: 'spot_range',
          severity: 'warning',
          contains: ['non-negative', '-0.05'],
        });
      });

      it.each([0, 0.05, 10.0, 1500])('says nothing about spot_range %s', (range) => {
        expectNoDiagnostic(scene(node('SpotLight3D', { spot_range: range })), {
          prop: 'spot_range',
        });
      });
    });

    // light_3d.cpp:673: spot_attenuation PROPERTY_HINT_RANGE
    // "-10,10,0.01,or_greater,or_less": both ends open, so nothing is out of band.
    describe('spot_attenuation carries no advisory', () => {
      it.each([0.05, 1.5, 7.0, -2])('says nothing about spot_attenuation %s', (attenuation) => {
        expectNoDiagnostic(scene(node('SpotLight3D', { spot_attenuation: attenuation })), {
          prop: 'attenuation',
        });
      });
    });

    // light_3d.cpp:675: spot_angle_attenuation is PROPERTY_HINT_EXP_EASING, which
    // states no range, so it carries no advisory either.
    describe('spot_angle_attenuation carries no advisory', () => {
      it.each([0.05, 1.5, 7.0, 21.1121])(
        'says nothing about spot_angle_attenuation %s',
        (angleAttenuation) => {
          expectNoDiagnostic(
            scene(node('SpotLight3D', { spot_angle_attenuation: angleAttenuation })),
            { prop: 'attenuation' }
          );
        }
      );
    });

    // light_3d.cpp:674: spot_angle PROPERTY_HINT_RANGE "0,180,0.01,degrees": both
    // ends closed, neither enforced.
    describe('spot_angle warnings', () => {
      it('should warn below the hint', () => {
        expectDiagnostic(scene(node('SpotLight3D', { spot_angle: -0.5 })), {
          prop: 'spot_angle',
          severity: 'warning',
          contains: ['between 0 and 180', '-0.5'],
        });
      });

      it('should warn above the hint', () => {
        expectDiagnostic(scene(node('SpotLight3D', { spot_angle: 181 })), {
          prop: 'spot_angle',
          severity: 'warning',
          contains: ['between 0 and 180', '181'],
        });
      });

      it.each([0, 0.5, 45.0, 91, 180])('says nothing about spot_angle %s', (angle) => {
        expectNoDiagnostic(scene(node('SpotLight3D', { spot_angle: angle })), {
          prop: 'spot_angle',
        });
      });
    });
  });

  // light_3d.cpp:655: `has_shadow() && get_param(PARAM_SPOT_ANGLE) >= 90.0`
  describe('shadow angle too wide', () => {
    it('warns when shadow_enabled is true and spot_angle is exactly 90', () => {
      expectDiagnostic(scene(node('SpotLight3D', { shadow_enabled: true, spot_angle: 90 })), {
        ruleName: 'spotlight3d-shadow-angle-too-wide',
        severity: 'warning',
      });
    });

    it('warns when shadow_enabled is true and spot_angle is above 90', () => {
      expectDiagnostic(scene(node('SpotLight3D', { shadow_enabled: true, spot_angle: 150 })), {
        ruleName: 'spotlight3d-shadow-angle-too-wide',
        severity: 'warning',
      });
    });

    it('warns on an infinite spot_angle, which is wider than 90 like any other', () => {
      // `set_param` stores the value as-is; light_3d.cpp:655 then compares it.
      expectDiagnostic(scene(node('SpotLight3D', { shadow_enabled: true, spot_angle: 'inf' })), {
        ruleName: 'spotlight3d-shadow-angle-too-wide',
        severity: 'warning',
      });
    });

    it('does not warn on a nan spot_angle, which no comparison places above 90', () => {
      expectNoDiagnostic(scene(node('SpotLight3D', { shadow_enabled: true, spot_angle: 'nan' })), {
        ruleName: 'spotlight3d-shadow-angle-too-wide',
      });
    });

    it('does not warn when shadow_enabled is true and spot_angle is below 90', () => {
      expectNoDiagnostic(scene(node('SpotLight3D', { shadow_enabled: true, spot_angle: 89 })), {
        ruleName: 'spotlight3d-shadow-angle-too-wide',
      });
    });

    it('does not warn when shadow_enabled is false, regardless of spot_angle', () => {
      expectNoDiagnostic(scene(node('SpotLight3D', { shadow_enabled: false, spot_angle: 150 })), {
        ruleName: 'spotlight3d-shadow-angle-too-wide',
      });
    });

    it('does not warn when shadow_enabled is true and spot_angle is absent (default 45)', () => {
      expectNoDiagnostic(scene(node('SpotLight3D', { shadow_enabled: true })), {
        ruleName: 'spotlight3d-shadow-angle-too-wide',
      });
    });
  });

  // light_3d.cpp:659-661, same shape as OmniLight3D's
  describe('projector without shadow', () => {
    it('warns when light_projector is set and shadow_enabled is not true', () => {
      expectDiagnostic(
        scene(node('SpotLight3D', { light_projector: 'ExtResource("1_proj")', spot_angle: 45.0 })),
        { ruleName: 'spotlight3d-projector-without-shadow', severity: 'warning' }
      );
    });

    it('does not warn when light_projector is set and shadow_enabled is true', () => {
      expectNoDiagnostic(
        scene(
          node('SpotLight3D', {
            light_projector: 'ExtResource("1_proj")',
            shadow_enabled: true,
            spot_angle: 45.0,
          })
        ),
        { ruleName: 'spotlight3d-projector-without-shadow' }
      );
    });

    it('does not warn when light_projector is absent', () => {
      expectNoDiagnostic(scene(node('SpotLight3D', { spot_angle: 45.0 })), {
        ruleName: 'spotlight3d-projector-without-shadow',
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle node with no properties', () => {
      expectClean(scene(node('SpotLight3D')));
    });

    it('should handle all properties together', () => {
      expectClean(
        scene(
          node('SpotLight3D', {
            light_energy: '1.0',
            light_color: 'Color(1, 0.95, 0.9, 1)',
            light_indirect_energy: '1.0',
            light_volumetric_fog_energy: '1.0',
            light_negative: false,
            light_specular: '0.5',
            light_bake_mode: 1,
            light_cull_mask: 1048575,
            shadow_enabled: true,
            shadow_bias: '0.1',
            shadow_normal_bias: '2.0',
            shadow_blur: '1.0',
            shadow_transmittance_bias: '0.5',
            shadow_opacity: '1.0',
            shadow_reverse_cull_face: false,
            spot_range: '10.0',
            spot_attenuation: '1.0',
            spot_angle: '45.0',
            spot_angle_attenuation: '1.0',
          })
        )
      );
    });

    it('should handle multiple validation errors', () => {
      const diagnostics = lint(
        scene(node('SpotLight3D', { light_energy: 0, spot_angle: 100, shadow_opacity: '2.0' }))
      );
      // light_energy=0 and spot_angle=100 are both in band (light_3d.cpp:389/:674);
      // only shadow_opacity=2.0 is out of its "0,1,0.01" hint at :407.
      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0]?.message).toContain('shadow_opacity');
    });

    it('should handle scientific notation in numeric values', () => {
      expectClean(
        scene(
          node('SpotLight3D', {
            light_energy: '1.5e0',
            shadow_bias: '1e-1',
            spot_range: '5e0',
            spot_attenuation: '1.2e0',
            spot_angle: '4.5e1',
            spot_angle_attenuation: '1.0e0',
          })
        )
      );
    });

    it('treats every extreme value here as a warning, none as an error', () => {
      const diagnostics = lint(
        scene(
          node('SpotLight3D', {
            light_energy: 150,
            spot_range: 1500,
            spot_angle: '0.5',
            spot_attenuation: '0.05',
            shadow_opacity: '2.0',
          })
        )
      );
      expect(diagnostics.length).toBeGreaterThan(0);
      // shadow_opacity (light_3d.cpp:407) is a hint behind Light3D::set_param's
      // index-only guard, same as every other bound here, so nothing in this
      // scene can be an error (ADR-0032).
      expect(diagnostics.every((d) => d.severity === 'warning')).toBe(true);
    });

    it('should handle only spot-specific properties', () => {
      expectClean(
        scene(
          node('SpotLight3D', {
            spot_range: 10.0,
            spot_angle: 45.0,
            spot_attenuation: 1.0,
            spot_angle_attenuation: 1.0,
          })
        )
      );
    });

    it('should handle boundary values for spot_angle', () => {
      // 0 and 180 are the hint's own ends (light_3d.cpp:674), so both are in band.
      expectClean(scene(node('SpotLight3D', { spot_angle: 0 })));
      expectClean(scene(node('SpotLight3D', { spot_angle: 180 })));
      expectDiagnostic(scene(node('SpotLight3D', { spot_angle: 180.01 })), {
        prop: 'spot_angle',
        severity: 'warning',
        contains: ['between 0 and 180'],
      });
    });

    it('should handle extreme combinations', () => {
      const diagnostics = lint(
        scene(
          node('SpotLight3D', {
            light_energy: '-0.005',
            spot_range: '-1500',
            spot_angle: '-0.5',
            spot_attenuation: '7.0',
            spot_angle_attenuation: '7.0',
          })
        )
      );
      // Three properties below their hints warn; the two attenuations have no
      // hint band at all (light_3d.cpp:673/:675) and stay silent.
      expect(diagnostics).toHaveLength(3);
      expect(diagnostics.every((d) => d.severity === 'warning')).toBe(true);
      expect(
        ['light_energy', 'spot_range', 'spot_angle'].filter(
          (property) => !diagnostics.some((d) => d.message.includes(property))
        )
      ).toEqual([]);
    });

    it('should handle spot_angle at exact boundaries', () => {
      for (const angle of [0, 90]) {
        expectNoErrors(scene(node('SpotLight3D', { spot_angle: angle, spot_range: 5.0 })), {
          prop: 'spot_angle',
        });
      }
    });

    it('should handle zero attenuation values (edge case)', () => {
      // Zero attenuation is in band for both attenuation properties.
      expectNoErrors(
        scene(
          node('SpotLight3D', {
            spot_attenuation: 0,
            spot_angle_attenuation: 0,
            spot_range: 5.0,
            spot_angle: 45.0,
          })
        )
      );
    });
  });
});
