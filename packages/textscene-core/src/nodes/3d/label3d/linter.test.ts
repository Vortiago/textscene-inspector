/**
 * Tests for Label3D linter (strict parser + semantic rules)
 */

import { describe, it } from 'vitest';
import {
  node,
  scene,
  expectClean,
  expectNoErrors,
  expectDiagnostic,
  runPropertyValidation,
} from '../../../linter/testing/testkit';
import './linterParser';
import './linter';

describe('Label3D Linter', () => {
  describe('Strict Parser Validation (Format)', () => {
    it('should pass validation for valid Label3D with all properties', () => {
      expectClean(
        scene(
          node('Label3D', {
            text: '"Hello World"',
            pixel_size: 0.01,
            billboard: 1,
            modulate: 'Color(1, 1, 1, 1)',
            outline_size: 8,
            outline_modulate: 'Color(0, 0, 0, 1)',
          })
        )
      );
    });

    it('should pass validation for minimal Label3D (only text)', () => {
      expectClean(scene(node('Label3D', { text: '"Test"' })));
    });

    describe('text validation', () => {
      it('should accept valid quoted text', () => {
        expectClean(scene(node('Label3D', { text: '"Hello World"' })));
      });

      it('should accept empty quoted string', () => {
        // Note: empty text might trigger a warning, but not an error
        expectNoErrors(scene(node('Label3D', { text: '""' })), { prop: 'text' });
      });
    });

    runPropertyValidation({ nodeType: 'Label3D' }, [
      {
        prop: 'pixel_size',
        valid: [0.01],
        invalid: [
          { value: 'invalid', contains: ['must be a number'] },
          { value: -0.5, contains: ['greater than 0'] },
          { value: 0, contains: ['greater than 0'] },
        ],
      },
      {
        prop: 'billboard',
        valid: [0, 1, 2],
        invalid: [
          { value: 3, contains: ['must be 0-2'] },
          { value: 5, contains: ['must be 0-2'] },
          { value: 'invalid', contains: ['must be a number'] },
        ],
      },
      {
        // Four modes, ALPHA_CUT_MAX = 4 (scene/3d/label_3d.h:50-56).
        prop: 'alpha_cut',
        valid: [0, 1, 2, 3],
        invalid: [
          { value: 4, contains: ['alpha_cut', '0-3'] },
          { value: 5, contains: ['alpha_cut', '0-3'] },
          { value: 'invalid', contains: ['must be a number'] },
        ],
      },
      {
        prop: 'modulate',
        valid: ['Color(1, 0.5, 0, 1)'],
        invalid: [{ value: 'RGB(255, 128, 0)', contains: ['Color('] }],
      },
      {
        prop: 'outline_size',
        valid: [8, 0],
        invalid: [
          { value: 'invalid', contains: ['must be a number'] },
          { value: -5, contains: ['must be >= 0'] },
        ],
      },
      {
        prop: 'outline_modulate',
        valid: ['Color(0, 0, 0, 1)'],
        invalid: [{ value: 'invalid', contains: ['Color('] }],
      },
    ]);
  });

  describe('Semantic Validation Rules', () => {
    it('should warn when text is empty', () => {
      expectDiagnostic(scene(node('Label3D', { text: '""' })), {
        ruleName: 'label3d-empty-text',
        severity: 'warning',
        nodeType: 'Label3D',
        contains: ['empty'],
      });
    });

    it('should warn when pixel_size is very large', () => {
      expectDiagnostic(scene(node('Label3D', { text: '"Test"', pixel_size: 2.0 })), {
        ruleName: 'label3d-large-pixel-size',
        severity: 'warning',
        nodeType: 'Label3D',
        contains: ['pixel_size', 'very large'],
      });
    });
  });
});
