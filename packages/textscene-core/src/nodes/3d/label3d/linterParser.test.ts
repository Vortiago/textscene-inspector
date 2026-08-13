/**
 * Tests for the Label3D strict-parser validators.
 */

import { describe, expect, it } from 'vitest';
import {
  node,
  scene,
  expectClean,
  runPropertyValidation,
} from '../../../linter/testing/testkit';
import { validatorRegistry } from '../../../linter/ValidatorRegistry';
import './linterParser';

/** The error a validator returns for a value, or null when it accepts it. */
function check(property: string, value: string) {
  const validator = validatorRegistry.findValidator('Label3D', property);
  expect(validator, `no validator registered for Label3D.${property}`).not.toBeNull();
  return validator!(property, value, 1);
}

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
        // label_3d.cpp:131 hints "0.0001,128,0.0001,suffix:m", closed at both
        // ends; set_pixel_size (:954) is a bare assignment, so one step past
        // either endpoint warns rather than erroring.
        prop: 'pixel_size',
        valid: [0.01, 0.0001, 128],
        invalid: [
          { value: 'invalid', contains: ['must be a number'] },
          {
            value: 0.00001,
            severity: 'warning',
            contains: ['must be between 0.0001 and 128'],
          },
          { value: 200, severity: 'warning', contains: ['must be between 0.0001 and 128'] },
        ],
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
        // set_horizontal_alignment (label_3d.cpp:678) opens with
        // ERR_FAIL_INDEX((int)p_alignment, 4), so both ends are refused
        // outright — errors, not the :156 hint's warning tier. Both endpoints
        // are probed from both sides: 0 and 3 load, -1 and 4 do not.
        prop: 'horizontal_alignment',
        valid: [0, 3],
        invalid: [
          { value: 4, severity: 'error', contains: ['must be 0-3'] },
          { value: -1, severity: 'error', contains: ['must be 0-3'] },
          { value: 'invalid', contains: ['must be a number'] },
        ],
      },
      {
        prop: 'modulate',
        valid: ['Color(1, 0.5, 0, 1)'],
        invalid: [{ value: 'RGB(255, 128, 0)', contains: ['Color('] }],
      },
      {
        // label_3d.cpp:154 hints "1,256,1,or_greater,suffix:px" and declares
        // Variant::INT; set_font_size (label_3d.cpp:861-867) only guards against
        // a redundant set, so the floor warns and `or_greater` leaves the top
        // open. A float literal loads: Godot coerces it into the INT property.
        prop: 'font_size',
        valid: [16, 1, 256, 9000, 12.5],
        invalid: [
          { value: 'invalid', contains: ['must be a number'] },
          { value: 0, severity: 'warning', contains: ['font_size'] },
        ],
      },
      {
        // label_3d.cpp:155 hints "0,127,1,suffix:px", closed at both ends;
        // set_outline_size (label_3d.cpp:873-880) assigns straight through, so
        // both endpoints load and one step past either only warns.
        prop: 'outline_size',
        valid: [8, 0, 127],
        invalid: [
          { value: 'invalid', contains: ['must be a number'] },
          { value: -1, severity: 'warning', contains: ['must be between 0 and 127'] },
          { value: 128, severity: 'warning', contains: ['must be between 0 and 127'] },
        ],
      },
      {
        prop: 'outline_modulate',
        valid: ['Color(0, 0, 0, 1)'],
        invalid: [{ value: 'invalid', contains: ['Color('] }],
      },
    ]);

    describe('double_sided', () => {
      it('accepts true', () => {
        expect(check('double_sided', 'true')).toBeNull();
      });
      it('rejects a non-boolean value', () => {
        expect(check('double_sided', '1')).not.toBeNull();
      });
    });

    describe('fixed_size', () => {
      it('accepts false', () => {
        expect(check('fixed_size', 'false')).toBeNull();
      });
      it('rejects a non-boolean value', () => {
        expect(check('fixed_size', 'nope')).not.toBeNull();
      });
    });

    describe('shaded', () => {
      it('accepts true', () => {
        expect(check('shaded', 'true')).toBeNull();
      });
      it('rejects a non-boolean value', () => {
        expect(check('shaded', 'nope')).not.toBeNull();
      });
    });

    describe('uppercase', () => {
      it('accepts false', () => {
        expect(check('uppercase', 'false')).toBeNull();
      });
      it('rejects a non-boolean value', () => {
        expect(check('uppercase', 'nope')).not.toBeNull();
      });
    });

    describe('language', () => {
      it('accepts a quoted locale', () => {
        expect(check('language', '"en"')).toBeNull();
      });
      it('rejects an unquoted string', () => {
        expect(check('language', 'en')).not.toBeNull();
      });
    });

    describe('offset', () => {
      it('accepts a Vector2', () => {
        expect(check('offset', 'Vector2(0, -4)')).toBeNull();
      });
      it('rejects a malformed literal', () => {
        expect(check('offset', 'not-a-vector')).not.toBeNull();
      });
    });

    describe('width', () => {
      it('accepts a float', () => {
        expect(check('width', '500')).toBeNull();
      });
      it('accepts a negative float — no bound, only a suffix', () => {
        expect(check('width', '-1')).toBeNull();
      });
      it('rejects a non-numeric value', () => {
        expect(check('width', 'wide')).not.toBeNull();
      });
    });

    describe('font', () => {
      it('accepts an ExtResource reference', () => {
        expect(check('font', 'ExtResource("1_font")')).toBeNull();
      });
      it('accepts a SubResource reference', () => {
        expect(check('font', 'SubResource("FontFile_1")')).toBeNull();
      });
      it('rejects a bare path', () => {
        expect(check('font', '"res://font.ttf"')).not.toBeNull();
      });
    });

    describe('structured_text_bidi_override_options', () => {
      it('accepts an empty Array literal', () => {
        expect(check('structured_text_bidi_override_options', '[]')).toBeNull();
      });
      it('accepts a populated Array literal', () => {
        expect(check('structured_text_bidi_override_options', '[1, 2]')).toBeNull();
      });
      it('rejects a non-Array literal', () => {
        expect(check('structured_text_bidi_override_options', '5')).not.toBeNull();
      });
    });

    describe('alpha_scissor_threshold', () => {
      it('accepts a value inside the hint', () => {
        expect(check('alpha_scissor_threshold', '0.5')).toBeNull();
      });
      it('warns above the hint — the setter bare-assigns', () => {
        expect(check('alpha_scissor_threshold', '1.5')?.severity).toBe('warning');
      });
    });

    describe('alpha_hash_scale', () => {
      it('accepts a value inside the hint', () => {
        expect(check('alpha_hash_scale', '1')).toBeNull();
      });
      it('warns above the hint — the setter bare-assigns', () => {
        expect(check('alpha_hash_scale', '3')?.severity).toBe('warning');
      });
    });

    describe('alpha_antialiasing_edge', () => {
      it('accepts a value inside the hint', () => {
        expect(check('alpha_antialiasing_edge', '0.5')).toBeNull();
      });
      it('warns above the hint — the setter bare-assigns', () => {
        expect(check('alpha_antialiasing_edge', '2')?.severity).toBe('warning');
      });
    });

    describe('alpha_antialiasing_mode', () => {
      it('accepts 2 (ALPHA_TO_COVERAGE_AND_TO_ONE), the last hinted entry', () => {
        expect(check('alpha_antialiasing_mode', '2')).toBeNull();
      });
      it('rejects 3, one past the hint — the setter bare-assigns so this warns', () => {
        expect(check('alpha_antialiasing_mode', '3')?.severity).toBe('warning');
      });
    });

    describe('structured_text_bidi_override', () => {
      it('accepts 6 (Custom), the last hinted entry', () => {
        expect(check('structured_text_bidi_override', '6')).toBeNull();
      });
      it('warns past the hint — set_structured_text_bidi_override bare-assigns', () => {
        expect(check('structured_text_bidi_override', '7')?.severity).toBe('warning');
      });
    });

    describe('autowrap_mode', () => {
      it('accepts 3 (AUTOWRAP_WORD_SMART), the last entry', () => {
        expect(check('autowrap_mode', '3')).toBeNull();
      });
      it('warns past the enum — set_autowrap_mode bare-assigns', () => {
        expect(check('autowrap_mode', '4')?.severity).toBe('warning');
      });
    });

    describe('texture_filter', () => {
      it('accepts 5, the last of 6 hinted entries', () => {
        expect(check('texture_filter', '5')).toBeNull();
      });
      it('warns past the hint — set_texture_filter bare-assigns', () => {
        expect(check('texture_filter', '6')?.severity).toBe('warning');
      });
    });

    describe('alpha_cut', () => {
      it('accepts 3 (ALPHA_CUT_HASH), the last legal value', () => {
        expect(check('alpha_cut', '3')).toBeNull();
      });
      it('rejects 4, one past ALPHA_CUT_MAX — the setter ERR_FAIL_INDEXes', () => {
        expect(check('alpha_cut', '4')?.severity).toBe('error');
      });
    });

    describe('vertical_alignment', () => {
      it('accepts 3 (FILL) — the setter permits it though the hint lists only 3 labels', () => {
        expect(check('vertical_alignment', '3')).toBeNull();
      });
      it('rejects 4, one past the setter bound', () => {
        expect(check('vertical_alignment', '4')?.severity).toBe('error');
      });
    });

    describe('text_direction', () => {
      it('accepts -1, a legacy inherited spelling with no named constant', () => {
        expect(check('text_direction', '-1')).toBeNull();
      });
      it('accepts 3 (INHERITED), the setter ceiling', () => {
        expect(check('text_direction', '3')).toBeNull();
      });
      it('rejects -2, one past the setter floor', () => {
        expect(check('text_direction', '-2')?.severity).toBe('error');
      });
      it('rejects 4, one past the setter ceiling', () => {
        expect(check('text_direction', '4')?.severity).toBe('error');
      });
    });

    describe('autowrap_trim_flags', () => {
      it('accepts a subset of the hinted bits', () => {
        expect(check('autowrap_trim_flags', '192')).toBeNull();
      });
      it('rejects a bit outside BREAK_TRIM_MASK, which the setter drops silently', () => {
        const error = check('autowrap_trim_flags', '3');
        expect(error?.severity).toBe('error');
        expect(error?.message).toContain('Godot stores 0');
      });
      it('warns on BREAK_TRIM_INDENT, which the setter keeps but the hint omits', () => {
        expect(check('autowrap_trim_flags', '32')?.severity).toBe('warning');
      });
    });

    describe('justification_flags', () => {
      it('accepts a subset of the hinted bits', () => {
        expect(check('justification_flags', '3')).toBeNull();
      });
      it('warns on JUSTIFICATION_TRIM_EDGE_SPACES (4), kept but not hinted', () => {
        expect(check('justification_flags', '4')?.severity).toBe('warning');
      });
    });
  });
});
