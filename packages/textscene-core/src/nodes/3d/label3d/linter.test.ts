/**
 * Tests for Label3D linter (strict parser + semantic rules)
 */

import { describe, it } from 'vitest';
import {
  node,
  scene,
  expectClean,
  expectNoDiagnostic,
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
        // Empty is the serialised default, so it reports nothing at all.
        expectClean(scene(node('Label3D', { text: '""' })));
      });
    });

    runPropertyValidation({ nodeType: 'Label3D' }, [
      {
        // label_3d.cpp:954 is a bare assignment, so the hint at :131
        // ("0.0001,128,0.0001") only warns: 0 and -0.5 load, they do not error.
        prop: 'pixel_size',
        valid: [0.01, 0.0001, 128],
        invalid: [{ value: 'invalid', contains: ['must be a number'] }],
      },
      {
        prop: 'pixel_size',
        valid: [0, -0.5, 200],
        acceptMode: 'no-error',
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
    // label_3d.cpp:131 — pixel_size PROPERTY_HINT_RANGE "0.0001,128,0.0001", closed
    // at both ends and enforced at neither.
    it('should warn when pixel_size is above the hint', () => {
      expectDiagnostic(scene(node('Label3D', { text: '"Test"', pixel_size: 200 })), {
        ruleName: 'label3d-large-pixel-size',
        severity: 'warning',
        nodeType: 'Label3D',
        contains: ['pixel_size', '200', '128'],
      });
    });

    it('should warn when pixel_size is below the hint', () => {
      expectDiagnostic(scene(node('Label3D', { text: '"Test"', pixel_size: 0.00001 })), {
        ruleName: 'label3d-small-pixel-size',
        severity: 'warning',
        nodeType: 'Label3D',
        contains: ['pixel_size', '0.0001'],
      });
    });

    it.each([0.0001, 2.0, 128])('says nothing about pixel_size %s', (pixelSize) => {
      expectNoDiagnostic(scene(node('Label3D', { text: '"Test"', pixel_size: pixelSize })), {
        prop: 'pixel_size',
      });
    });
  });
});
