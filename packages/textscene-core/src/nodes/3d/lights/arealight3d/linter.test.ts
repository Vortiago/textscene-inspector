/**
 * Tests for AreaLight3D linter (strict parser + semantic rules)
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
import './linter';

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
        prop: 'light_energy',
        valid: [2.5],
        invalid: [
          { value: -1.0, contains: ['non-negative'] },
          { value: 'invalid', contains: ['must be a number'] },
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
        valid: [2.0],
        invalid: [
          { value: 0, contains: ['greater than 0'] },
          { value: -5.0, contains: ['greater than 0'] },
          { value: 'invalid', contains: ['must be a number'] },
        ],
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
      expectNoErrors(scene(node('AreaLight3D', { light_energy: 0, area_range: 2.0 })));
    });
  });

  describe('Semantic Validation', () => {
    describe('light energy warnings', () => {
      it('should warn on very low light_energy', () => {
        const diagnostics = lint(scene(node('AreaLight3D', { light_energy: 0.005, area_range: 2.0 })));
        expect(diagnostics.some(d => d.severity === 'warning' && d.message.includes('very low'))).toBe(true);
      });

      it('should warn on very high light_energy', () => {
        const diagnostics = lint(scene(node('AreaLight3D', { light_energy: 150, area_range: 2.0 })));
        expect(diagnostics.some(d => d.severity === 'warning' && d.message.includes('very high'))).toBe(true);
      });

      it('should not warn on normal light_energy values', () => {
        const diagnostics = lint(scene(node('AreaLight3D', { light_energy: 1.5, area_range: 2.0 })));
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
