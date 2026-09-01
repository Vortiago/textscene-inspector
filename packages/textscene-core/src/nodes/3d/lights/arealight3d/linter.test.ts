/**
 * Tests for AreaLight3D linting. The slice declares no semantic rule: its one
 * advisory was a `light_energy` range band, now the inherited Light3D
 * validator's bound (light_3d.cpp:389).
 */

import { describe, it, expect } from 'vitest';
import {
  scene,
  node,
  lint,
  expectClean,
  expectNoErrors,
  runPropertyValidation,
} from '../../../../linter/testing/testkit';
import './linterParser';

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

    runPropertyValidation({ nodeType: 'AreaLight3D' }, [
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
        prop: 'area_range',
        // 0 and negatives are VALID: nothing in the pinned reference refuses
        // them, so only the format check stands.
        valid: [2.0, 0, -5.0],
        invalid: [{ value: 'invalid', contains: ['must be a number'] }],
      },
      {
        prop: 'area_size',
        valid: ['Vector2(2, 1)'],
        invalid: [{ value: 'Vector2(2)', contains: ['Vector2'] }, { value: 'invalid' }],
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
    // light_3d.cpp:389 — light_energy PROPERTY_HINT_RANGE "0,16,0.001,or_greater":
    // `or_greater` opens the high end, so only a negative is out of band, and
    // the inherited Light3D validator is what reports it.
    describe('light energy warnings', () => {
      it('warns rather than errors on negative light_energy', () => {
        const diagnostics = lint(
          scene(node('AreaLight3D', { light_energy: -0.005, area_range: 2.0 }))
        );
        expect(
          diagnostics.some(
            d => d.severity === 'warning' && d.message.includes('light_energy')
          )
        ).toBe(true);
        expect(diagnostics.some(d => d.severity === 'error')).toBe(false);
      });

      it.each([0, 0.005, 1.5, 150])('says nothing about light_energy %s', (energy) => {
        const diagnostics = lint(
          scene(node('AreaLight3D', { light_energy: energy, area_range: 2.0 }))
        );
        expect(diagnostics.some(d => d.severity === 'warning')).toBe(false);
      });
    });

    it('should handle node with no properties', () => {
      expectClean(scene(node('AreaLight3D')));
    });

    it('should handle shadow_enabled = true without errors', () => {
      // RectAreaLight doesn't actually cast shadows; shadow_enabled is just validated as boolean
      expectNoErrors(scene(node('AreaLight3D', { shadow_enabled: true })));
    });
  });
});
