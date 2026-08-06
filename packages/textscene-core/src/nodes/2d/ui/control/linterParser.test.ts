/**
 * Control base validators. Control is the root of the 2D UI family; its
 * layout/anchor/offset + theme-override validators are inherited by every
 * Control subclass through the ValidatorRegistry base-walk. Scalar props run
 * through the shared accept/reject table; the `theme_override_*` wildcard groups
 * are asserted explicitly because their diagnostic is keyed by the group name.
 */

import { describe, it } from 'vitest';
import {
  node,
  scene,
  expectClean,
  expectDiagnostic,
  runPropertyValidation,
} from '../../../../linter/testing/testkit';
import './linterParser';

describe('Control Linter', () => {
  runPropertyValidation({ nodeType: 'Control' }, [
    {
      prop: 'visible',
      valid: ['true', 'false'],
      invalid: [{ value: 'maybe', contains: ['boolean'] }],
    },
    {
      prop: 'anchors_preset',
      valid: [-1, 0, 8, 15],
      invalid: [
        { value: 20, contains: ['between -1 and 15'] },
        { value: 'full', contains: ['must be a number'] },
      ],
    },
    {
      prop: 'offset_right',
      valid: [172.0, -8, 0],
      invalid: [{ value: 'abc', contains: ['must be a number'] }],
    },
    {
      prop: 'anchor_right',
      valid: [0, 0.5, 1.0],
      invalid: [{ value: 'x', contains: ['must be a number'] }],
    },
    {
      prop: 'grow_horizontal',
      valid: [0, 1, 2],
      invalid: [{ value: 9, contains: ['between 0 and 2'] }],
    },
    {
      prop: 'size_flags_horizontal',
      valid: [0, 1, 3],
      invalid: [{ value: 'fill', contains: ['must be a number'] }],
    },
    {
      prop: 'modulate',
      valid: ['Color(1, 1, 1, 1)', 'Color(0.5, 0.5, 0.5, 0.8)'],
      invalid: [{ value: 'Color(1, 1, 1)', contains: ['Color'] }],
    },
    {
      prop: 'z_index',
      valid: [0, -10, 4096, -4096, 5000],
      invalid: [{ value: 1.5, contains: ['integer'] }],
    },
    {
      prop: 'show_behind_parent',
      valid: ['true', 'false'],
      invalid: [{ value: 'maybe', contains: ['boolean'] }],
    },
    {
      prop: 'light_mask',
      valid: [0, 1, 4294967295],
      invalid: [{ value: 'top', contains: ['must be a number'] }],
    },
    {
      prop: 'texture_filter',
      valid: [0, 1, 6],
      invalid: [{ value: 7, contains: ['0-6'] }],
    },
    {
      prop: 'texture_repeat',
      valid: [0, 1, 3],
      invalid: [{ value: 4, contains: ['0-3'] }],
    },
  ]);

  describe('theme reference', () => {
    it('accepts an ExtResource theme', () => {
      expectClean(scene(node('Control', { theme: 'ExtResource("1_theme")' })));
    });

    it('accepts a SubResource theme (a scene-inline Theme)', () => {
      expectClean(scene(node('Control', { theme: 'SubResource("5")' })));
    });

    it('rejects a non-reference theme value', () => {
      expectDiagnostic(scene(node('Control', { theme: 'res://theme.tres' })), {
        prop: 'theme',
      });
    });
  });

  describe('theme_type_variation', () => {
    it('accepts a StringName literal', () => {
      expectClean(scene(node('Control', { theme_type_variation: '&"title_panel"' })));
    });

    it('rejects an empty value', () => {
      expectDiagnostic(scene(node('Control', { theme_type_variation: '' })), {
        prop: 'theme_type_variation',
      });
    });
  });

  describe('theme_override wildcard groups', () => {
    it('accepts a well-formed theme_override_colors entry', () => {
      expectClean(scene(node('Control', { 'theme_override_colors/font_color': 'Color(1, 1, 1, 1)' })));
    });

    it('rejects a malformed theme_override_colors Color', () => {
      expectDiagnostic(
        scene(node('Control', { 'theme_override_colors/font_color': 'Color(1, 1, 1)' })),
        { prop: 'theme_override_colors', contains: ['Color'] }
      );
    });

    it('accepts an integer theme_override_constants entry', () => {
      expectClean(scene(node('Control', { 'theme_override_constants/separation': 8 })));
    });

    it('rejects a non-numeric theme_override_constants entry', () => {
      expectDiagnostic(
        scene(node('Control', { 'theme_override_constants/separation': 'wide' })),
        { prop: 'theme_override_constants' }
      );
    });

    it('accepts a SubResource theme_override_styles reference', () => {
      expectClean(
        scene(node('Control', { 'theme_override_styles/panel': 'SubResource("StyleBoxFlat_1")' }))
      );
    });

    it('rejects a non-reference theme_override_styles value', () => {
      expectDiagnostic(
        scene(node('Control', { 'theme_override_styles/panel': 'hello' })),
        { prop: 'theme_override_styles' }
      );
    });
  });

  // Every registered property must actually be wired under its exact key — a
  // typo in a registration key (e.g. `anchor_lft`) would silently disable that
  // validator. Feed each one a malformed value and assert it is rejected. Covers
  // the axis variants and props the accept/reject table above only spot-checks.
  describe('every registered Control property is validated', () => {
    const MALFORMED: ReadonlyArray<readonly [string, string]> = [
      ['theme', 'res://theme.tres'],
      ['theme_type_variation', ''],
      ['self_modulate', 'Color(1, 1, 1)'],
      ['layout_mode', 'x'],
      ['anchor_left', 'x'],
      ['anchor_top', 'x'],
      ['anchor_bottom', 'x'],
      ['offset_left', 'abc'],
      ['offset_top', 'abc'],
      ['offset_bottom', 'abc'],
      ['grow_vertical', '9'],
      ['rotation', 'spin'],
      ['scale', 'Vector2(1)'],
      ['pivot_offset', 'Vector2(1)'],
      ['size_flags_vertical', 'fill'],
      ['size_flags_stretch_ratio', 'half'],
      ['custom_minimum_size', 'Vector2(1)'],
      ['theme_override_font_sizes/font_size', 'big'],
      ['theme_override_fonts/font', 'notaref'],
      ['z_index', '1.5'],
      ['show_behind_parent', 'maybe'],
      ['light_mask', 'top'],
      ['texture_filter', '99'],
      ['texture_repeat', '99'],
    ];
    for (const [prop, value] of MALFORMED) {
      it(`rejects a malformed ${prop}`, () => {
        expectDiagnostic(scene(node('Control', { [prop]: value })), { prop: prop.split('/')[0]! });
      });
    }
  });
});
