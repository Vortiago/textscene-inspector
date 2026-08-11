/**
 * Tests for OmniLight3D linter (strict parser + semantic rules)
 */

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

describe('OmniLight3D Linter', () => {
  describe('Strict Parser Validation (Format)', () => {
    it('should pass validation for valid OmniLight3D properties', () => {
      expectClean(
        scene(
          node('OmniLight3D', {
            light_energy: 1.0,
            light_color: 'Color(1, 1, 1, 1)',
            omni_range: 5.0,
            omni_attenuation: 1.0,
            shadow_enabled: true,
            omni_shadow_mode: 1,
          })
        )
      );
    });

    runPropertyValidation({ nodeType: 'OmniLight3D' }, [
      {
        // light_3d.cpp:389 hints "0,16,0.001,or_greater" and Light3D::set_param:36
        // guards the param index, not the value, so a negative energy loads: it
        // warns rather than erroring.
        prop: 'light_energy',
        valid: [2.5, 0, -1.0],
        acceptMode: 'no-error',
        invalid: [{ value: 'invalid', contains: ['must be a number'] }],
      },
      {
        prop: 'light_color',
        valid: ['Color(0.95, 0.9, 0.85, 1)'],
        invalid: [{ value: 'RGB(1, 1, 1)', contains: ['Color'] }, { value: 'Color(1, 1, 1)' }],
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
        // stylised boost. Only the 0 floor is a real, warning-only bound
        // (set_param:36 guards the index, not the value).
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
        // light_3d.cpp:639 hints "0,4096,0.001,or_greater", unenforced, so 0 is
        // legal and a negative only warns.
        prop: 'omni_range',
        valid: [10.0, 0, -5.0],
        acceptMode: 'no-error',
        invalid: [{ value: 'invalid', contains: ['must be a number'] }],
      },
      {
        // light_3d.cpp:640 hints "-10,10,0.001,or_greater,or_less": the range
        // starts below zero and both ends are soft, so a negative is a legal
        // inverse falloff.
        prop: 'omni_attenuation',
        valid: [1.5, 0, -0.5, -2],
        acceptMode: 'no-error',
        invalid: [{ value: 'abc', contains: ['must be a number'] }],
      },
      {
        prop: 'omni_shadow_mode',
        valid: [0, 1],
        invalid: [{ value: 5, contains: ['0-1'] }, { value: -1 }],
      },
    ]);

    // Zero-energy accept cases trigger a "very low" warning, so only the
    // absence of *errors* is asserted (cannot use expectClean).
    it('should accept zero light_energy', () => {
      expectNoErrors(scene(node('OmniLight3D', { light_energy: 0, omni_range: 5.0 })));
    });

    it('should accept zero omni_attenuation', () => {
      expectNoErrors(scene(node('OmniLight3D', { omni_attenuation: 0, omni_range: 5.0 })));
    });
  });

  describe('Semantic Validation', () => {
    describe('missing omni_range error', () => {
      it('should not error when omni_range is missing', () => {
        expectNoErrors(
          scene(node('OmniLight3D', { light_energy: 1.0, light_color: 'Color(1, 1, 1, 1)' })),
          { prop: 'omni_range' }
        );
      });

      it('should not error when omni_range is present', () => {
        expectNoErrors(scene(node('OmniLight3D', { omni_range: 5.0 })), { prop: 'omni_range' });
      });
    });

    // light_3d.cpp:389 — light_energy PROPERTY_HINT_RANGE "0,16,0.001,or_greater".
    // The high end is open, so only a negative is out of band.
    describe('light energy warnings', () => {
      it('should warn on negative light_energy', () => {
        expectDiagnostic(scene(node('OmniLight3D', { light_energy: -1, omni_range: 5.0 })), {
          prop: 'Light energy',
          severity: 'warning',
          contains: ['negative', '-1'],
        });
      });

      it('should not warn at the bottom of the hint (0)', () => {
        expectNoDiagnostic(scene(node('OmniLight3D', { light_energy: 0, omni_range: 5.0 })), {
          prop: 'Light energy',
        });
      });

      it('should not warn above the open top of the hint', () => {
        expectNoDiagnostic(scene(node('OmniLight3D', { light_energy: 150, omni_range: 5.0 })), {
          prop: 'Light energy',
        });
      });
    });

    // light_3d.cpp:639 — omni_range PROPERTY_HINT_RANGE "0,4096,0.001,or_greater".
    describe('omni_range warnings', () => {
      it('should warn on negative omni_range', () => {
        expectDiagnostic(scene(node('OmniLight3D', { omni_range: -0.5 })), {
          prop: 'Light range',
          severity: 'warning',
          contains: ['negative', '-0.5'],
        });
      });

      it('should not warn on a tiny but non-negative omni_range', () => {
        expectNoDiagnostic(scene(node('OmniLight3D', { omni_range: 0.05 })), { prop: 'Light range' });
      });

      it('should not warn above the open top of the hint', () => {
        expectNoDiagnostic(scene(node('OmniLight3D', { omni_range: 1500 })), { prop: 'Light range' });
      });
    });

    // light_3d.cpp:640 — omni_attenuation PROPERTY_HINT_RANGE
    // "-10,10,0.001,or_greater,or_less": BOTH ends open, so no value is out of band.
    describe('omni_attenuation carries no advisory', () => {
      it.each([0.05, 1.5, 7.0, -2])('says nothing about omni_attenuation %s', (attenuation) => {
        expectNoDiagnostic(scene(node('OmniLight3D', { omni_attenuation: attenuation, omni_range: 5.0 })), {
          prop: 'attenuation',
        });
      });
    });
  });

  // light_3d.cpp:623-625
  describe('projector without shadow', () => {
    it('warns when light_projector is set and shadow_enabled is not true', () => {
      expectDiagnostic(
        scene(node('OmniLight3D', { light_projector: 'ExtResource("1_proj")', omni_range: 5.0 })),
        { ruleName: 'omnilight3d-projector-without-shadow', severity: 'warning' }
      );
    });

    it('does not warn when light_projector is set and shadow_enabled is true', () => {
      expectNoDiagnostic(
        scene(
          node('OmniLight3D', {
            light_projector: 'ExtResource("1_proj")',
            shadow_enabled: true,
            omni_range: 5.0,
          })
        ),
        { ruleName: 'omnilight3d-projector-without-shadow' }
      );
    });

    it('does not warn when light_projector is absent', () => {
      expectNoDiagnostic(scene(node('OmniLight3D', { omni_range: 5.0 })), {
        ruleName: 'omnilight3d-projector-without-shadow',
      });
    });

    it('does not warn when light_projector is present but malformed', () => {
      // The format validator already errors on it, and Godot sets no projector
      // from a value its reader rejects, so warning here reported one defect
      // twice.
      expectNoDiagnostic(
        scene(node('OmniLight3D', { light_projector: 'not-a-reference', omni_range: 5.0 })),
        { ruleName: 'omnilight3d-projector-without-shadow' }
      );
    });
  });

  describe('Edge Cases', () => {
    it('should handle node with no properties', () => {
      expectClean(scene(node('OmniLight3D')));
    });

    it('should handle all properties together', () => {
      expectClean(
        scene(
          node('OmniLight3D', {
            light_energy: 1.0,
            light_color: 'Color(1, 0.95, 0.9, 1)',
            light_indirect_energy: 1.0,
            light_volumetric_fog_energy: 1.0,
            light_negative: false,
            light_specular: 0.5,
            light_bake_mode: 1,
            light_cull_mask: 1048575,
            shadow_enabled: true,
            shadow_bias: 0.1,
            shadow_normal_bias: 2.0,
            shadow_blur: 1.0,
            shadow_transmittance_bias: 0.5,
            shadow_opacity: 1.0,
            shadow_reverse_cull_face: false,
            omni_range: 10.0,
            omni_attenuation: 1.0,
            omni_shadow_mode: 1,
          })
        )
      );
    });

    it('should handle multiple out-of-hint values as warnings', () => {
      const diagnostics = lint(
        scene(node('OmniLight3D', { light_energy: 0, omni_shadow_mode: 10, shadow_opacity: 2.0 }))
      );
      expect(diagnostics).toHaveLength(2);
      // omni_shadow_mode (light_3d.cpp:641) and shadow_opacity (light_3d.cpp:407,
      // via Light3D::set_param's index-only guard) are both hints, not
      // enforcement, so both diagnose as warnings, not errors. light_energy=0
      // is valid.
      expect(diagnostics.every((d) => d.severity === 'warning')).toBe(true);
      const hasModeWarning = diagnostics.some(d => d.message.includes('omni_shadow_mode'));
      const hasOpacityWarning = diagnostics.some(d => d.message.includes('shadow_opacity'));
      expect(hasModeWarning && hasOpacityWarning).toBe(true);
    });

    it('should handle scientific notation in numeric values', () => {
      expectClean(
        scene(
          node('OmniLight3D', {
            light_energy: '1.5e0',
            shadow_bias: '1e-1',
            omni_range: '5e0',
            omni_attenuation: '1.2e0',
          })
        )
      );
    });

    it('treats every extreme value here as a warning, none as an error', () => {
      const diagnostics = lint(
        scene(
          node('OmniLight3D', {
            light_energy: 150,
            omni_range: 1500,
            omni_attenuation: 0.05,
            shadow_opacity: 2.0,
          })
        )
      );
      expect(diagnostics.length).toBeGreaterThan(0);
      // None of OmniLight3D's bounds are Godot-enforced (light_3d.cpp:389/639/
      // 640/407 are all PROPERTY_HINT_RANGE behind Light3D::set_param's
      // index-only guard), so nothing here can be an error.
      expect(diagnostics.every((d) => d.severity === 'warning')).toBe(true);
    });

    it('should handle only omni-specific properties', () => {
      expectClean(
        scene(node('OmniLight3D', { omni_range: 5.0, omni_attenuation: 1.0, omni_shadow_mode: 0 }))
      );
    });

    it('should handle boundary values for omni_range', () => {
      // 0 is the bottom of the hint (light_3d.cpp:639) and therefore in band.
      expectClean(scene(node('OmniLight3D', { omni_range: 0 })));
      const diagnostics = lint(scene(node('OmniLight3D', { omni_range: -0.01 })));
      const warning = diagnostics.find(
        d => d.severity === 'warning' && d.message.includes('Light range is negative')
      );
      expect(warning).toBeDefined();
    });

    it('should handle extreme combinations', () => {
      const diagnostics = lint(
        scene(node('OmniLight3D', { light_energy: -0.005, omni_range: -1500, omni_attenuation: 7.0 }))
      );
      // Two out-of-band properties, two warnings: omni_attenuation's hint is open
      // at both ends (light_3d.cpp:640), so 7.0 contributes nothing.
      expect(diagnostics).toHaveLength(2);
      const energyWarning = diagnostics.find(d =>
        d.message.includes('Light energy is negative')
      );
      const rangeWarning = diagnostics.find(d => d.message.includes('Light range is negative'));
      expect(energyWarning).toBeDefined();
      expect(rangeWarning).toBeDefined();
      expect(diagnostics.some(d => d.message.includes('attenuation'))).toBe(false);
    });
  });
});
