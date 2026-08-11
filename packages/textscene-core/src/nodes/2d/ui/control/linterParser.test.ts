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
  ]);

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
      ['accessibility_name', 'unquoted'],
      ['accessibility_description', 'unquoted'],
      ['accessibility_live', 'x'],
      ['accessibility_controls_nodes', 'notanarray'],
      ['accessibility_described_by_nodes', 'notanarray'],
      ['accessibility_labeled_by_nodes', 'notanarray'],
      ['accessibility_flow_to_nodes', 'notanarray'],
      ['focus_neighbor_left', 'x'],
      ['focus_neighbor_top', 'x'],
      ['focus_neighbor_right', 'x'],
      ['focus_neighbor_bottom', 'x'],
      ['focus_next', 'x'],
      ['focus_previous', 'x'],
      ['focus_behavior_recursive', 'x'],
      ['mouse_behavior_recursive', 'x'],
      ['mouse_force_pass_scroll_events', 'maybe'],
      ['mouse_default_cursor_shape', 'x'],
      ['clip_contents', 'maybe'],
      ['localize_numeral_system', 'maybe'],
      ['layout_direction', 'x'],
      ['shortcut_context', 'x'],
      ['theme', 'notaref'],
      ['theme_type_variation', 'unquoted'],
      ['tooltip_auto_translate_mode', 'x'],
      ['tooltip_text', 'unquoted'],
    ];
    for (const [prop, value] of MALFORMED) {
      it(`rejects a malformed ${prop}`, () => {
        expectDiagnostic(scene(node('Control', { [prop]: value })), { prop: prop.split('/')[0]! });
      });
    }
  });

  // Bounded enums (ADR-0032): pin the last accepted constant AND the first
  // rejected value, from the engine's own count, not the label-list length.
  runPropertyValidation({ nodeType: 'Control' }, [
    {
      // control.cpp:4312, 3 BIND_ENUM_CONSTANTs (display_server.cpp:1768-1770).
      // Hinted only: control.cpp:2191-2196 has no ERR_FAIL.
      prop: 'accessibility_live',
      valid: [0, 2],
      invalid: [{ value: 3, contains: ['0-2'] }],
    },
    {
      // control.cpp:2295, ERR_FAIL_INDEX(x, 3) — enforced, so 3 is an error.
      prop: 'focus_behavior_recursive',
      valid: [0, 2],
      invalid: [{ value: 3, contains: ['0-2'] }],
    },
    {
      // control.cpp:1953, ERR_FAIL_INDEX(x, 3) — enforced.
      prop: 'mouse_behavior_recursive',
      valid: [0, 2],
      invalid: [{ value: 3, contains: ['0-2'] }],
    },
    {
      // control.cpp:2877, ERR_FAIL_INDEX(x, CURSOR_MAX=17) — enforced.
      prop: 'mouse_default_cursor_shape',
      valid: [0, 16],
      invalid: [{ value: 17, contains: ['0-16'] }],
    },
    {
      // control.cpp:3539, ERR_FAIL_INDEX(x, LAYOUT_DIRECTION_MAX=5) — enforced.
      prop: 'layout_direction',
      valid: [0, 4],
      invalid: [{ value: 5, contains: ['0-4'] }],
    },
    {
      // control.cpp:3657-3660, no ERR_FAIL — hinted, matching Node::AutoTranslateMode's
      // 3 BIND_ENUM_CONSTANTs (node.cpp:4032-4034).
      prop: 'tooltip_auto_translate_mode',
      valid: [0, 2],
      invalid: [{ value: 3, contains: ['0-2'] }],
    },
  ]);

  describe('accessibility node-path arrays', () => {
    it('accepts the empty Array[NodePath]([]) — control.cpp:2203-2247, empty is legal', () => {
      expectClean(scene(node('Control', { accessibility_controls_nodes: 'Array[NodePath]([])' })));
    });

    it('accepts Array[NodePath]([NodePath("../A"), NodePath("../B")])', () => {
      expectClean(
        scene(
          node('Control', {
            accessibility_described_by_nodes: 'Array[NodePath]([NodePath("../A"), NodePath("../B")])',
          })
        )
      );
    });

    it('accepts the bare [NodePath("../A")] spelling — TypedArray(const Array&) coerces it on load (typed_array.h:43-46)', () => {
      expectClean(scene(node('Control', { accessibility_labeled_by_nodes: '[NodePath("../A")]' })));
    });

    it('accepts NodePath("") inside the array — an empty path is legal (variantParser.ts NODE_PATH_BODY)', () => {
      expectClean(scene(node('Control', { accessibility_flow_to_nodes: 'Array[NodePath]([NodePath("")])' })));
    });

    it('rejects a non-NodePath element', () => {
      expectDiagnostic(
        scene(node('Control', { accessibility_controls_nodes: 'Array[NodePath]([1, 2])' })),
        { prop: 'accessibility_controls_nodes' }
      );
    });
  });

  describe('NodePath("") accepted for every NodePath-typed key', () => {
    const NODE_PATH_KEYS = [
      'focus_neighbor_left',
      'focus_neighbor_top',
      'focus_neighbor_right',
      'focus_neighbor_bottom',
      'focus_next',
      'focus_previous',
      'shortcut_context',
    ] as const;
    for (const prop of NODE_PATH_KEYS) {
      it(`accepts NodePath("") for ${prop}`, () => {
        expectClean(scene(node('Control', { [prop]: 'NodePath("")' })));
      });
    }
  });

  describe('theme (nullable resource slot)', () => {
    it('accepts a SubResource("id") theme', () => {
      expectClean(scene(node('Control', { theme: 'SubResource("Theme_1")' })));
    });

    it('accepts the literal null — an instance override clearing an inherited theme writes this (control.cpp:2986-3009, variant_parser.cpp:2184-2187)', () => {
      expectClean(scene(node('Control', { theme: 'null' })));
    });

    it('rejects a bare word', () => {
      expectDiagnostic(scene(node('Control', { theme: 'hello' })), { prop: 'theme' });
    });
  });

  describe('theme_type_variation accepts the StringName spelling Godot writes', () => {
    it('accepts &"PanelVariation" — the getter returns StringName despite ADD_PROPERTY declaring STRING (control.cpp:3028, variant_parser.cpp:2147-2151)', () => {
      expectClean(scene(node('Control', { theme_type_variation: '&"PanelVariation"' })));
    });

    it('accepts a plain quoted string too', () => {
      expectClean(scene(node('Control', { theme_type_variation: '"PanelVariation"' })));
    });
  });
});
