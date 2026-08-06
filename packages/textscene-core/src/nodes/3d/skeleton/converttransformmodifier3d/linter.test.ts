/**
 * Tests for ConvertTransformModifier3D's semantic linter rule. Strict-parser
 * format checks live in linterParser.test.ts and are asserted through
 * validatorRegistry there.
 *
 * The rule exists because the range hint is chosen from a SIBLING property, so
 * these cases are all about which of the three hint arms a given
 * `transform_mode` selects, and each one pins a value the other two arms would
 * judge differently.
 *
 * Uses `Linter` directly (via testkit), not the `linter/index.ts` barrel: that
 * barrel side-effect-imports every in-flight slice, so pulling it here would
 * fail flakily on a sibling's half-written file mid-wave.
 */

import { describe, it, expect } from 'vitest';
import {
  node,
  scene,
  expectClean,
  expectDiagnostic,
  expectNoDiagnostic,
  lint,
} from '../../../../linter/testing/testkit';
import { readFixture } from '../../../../linter/testing/fixtureCheck';
import './linterParser';
import './linter';

const RULE = 'converttransformmodifier3d-range-outside-mode-hint';

/** `Math::PI` to the seven digits Godot's serialiser writes. */
const GODOT_PI = '3.1415927';

describe('ConvertTransformModifier3D range-versus-mode rule', () => {
  describe('Rotation mode (1), hinted -180..180 with radians_as_degrees', () => {
    it('warns above PI radians', () => {
      expectDiagnostic(
        scene(
          node('ConvertTransformModifier3D', {
            setting_count: 1,
            'settings/0/apply/transform_mode': 1,
            'settings/0/apply/range_max': 3.5,
          })
        ),
        {
          ruleName: RULE,
          severity: 'warning',
          nodeType: 'ConvertTransformModifier3D',
          contains: ['settings/0/apply/range_max', 'Rotation'],
        }
      );
    });

    it('warns below -PI radians', () => {
      expectDiagnostic(
        scene(
          node('ConvertTransformModifier3D', {
            setting_count: 1,
            'settings/0/reference/transform_mode': 1,
            'settings/0/reference/range_min': -4,
          })
        ),
        { ruleName: RULE, severity: 'warning', contains: ['settings/0/reference/range_min'] }
      );
    });

    it('accepts the PI Godot itself serialises, so the epsilon holds', () => {
      expectClean(
        scene(
          node('ConvertTransformModifier3D', {
            setting_count: 1,
            'settings/0/apply/transform_mode': 1,
            'settings/0/apply/range_min': `-${GODOT_PI}`,
            'settings/0/apply/range_max': GODOT_PI,
          })
        )
      );
    });
  });

  describe('Scale mode (2), hinted 0..10 with or_greater', () => {
    it('warns below the 0 floor', () => {
      expectDiagnostic(
        scene(
          node('ConvertTransformModifier3D', {
            setting_count: 1,
            'settings/0/apply/transform_mode': 2,
            'settings/0/apply/range_min': -1,
          })
        ),
        { ruleName: RULE, severity: 'warning', contains: ['settings/0/apply/range_min', 'Scale'] }
      );
    });

    it('leaves a value above the hinted 10 alone, because or_greater opens that end', () => {
      expectClean(
        scene(
          node('ConvertTransformModifier3D', {
            setting_count: 1,
            'settings/0/apply/transform_mode': 2,
            'settings/0/apply/range_min': 0,
            'settings/0/apply/range_max': 500,
          })
        )
      );
    });

    it('treats a mode outside the enum as Scale, matching the else branch', () => {
      // `_get_property_list` tests POSITION, then ROTATION, then falls to
      // HINT_SCALE for everything else (convert_transform_modifier_3d.cpp:134-140).
      // The out-of-enum mode itself is the validator's warning, not this rule's.
      const diagnostics = lint(
        scene(
          node('ConvertTransformModifier3D', {
            setting_count: 1,
            'settings/0/apply/transform_mode': 7,
            'settings/0/apply/range_min': -1,
          })
        )
      ).filter((d) => d.ruleName === RULE);
      expect(diagnostics).toHaveLength(1);
    });
  });

  describe('Position mode (0), hinted with BOTH or_greater and or_less', () => {
    it('claims nothing, however far out the value sits', () => {
      expectClean(
        scene(
          node('ConvertTransformModifier3D', {
            setting_count: 1,
            'settings/0/apply/transform_mode': 0,
            'settings/0/apply/range_min': -100000,
            'settings/0/apply/range_max': 100000,
          })
        )
      );
    });

    it('is the default when transform_mode is absent, as the struct initialiser says', () => {
      // ConvertTransform3DSetting::apply_transform_mode = TRANSFORM_MODE_POSITION
      // (convert_transform_modifier_3d.h:46), and Godot omits a default.
      expectClean(
        scene(
          node('ConvertTransformModifier3D', {
            setting_count: 1,
            'settings/0/apply/range_max': 100000,
          })
        )
      );
    });
  });

  it('reads each group and each index against its OWN sibling', () => {
    // apply is Rotation and out of range; reference is Position and must stay
    // clean beside it, at a different index than the one that warns.
    const diagnostics = lint(
      scene(
        node('ConvertTransformModifier3D', {
          setting_count: 2,
          'settings/0/apply/transform_mode': 1,
          'settings/0/apply/range_max': 9,
          'settings/0/reference/transform_mode': 0,
          'settings/0/reference/range_max': 9,
          'settings/1/apply/transform_mode': 0,
          'settings/1/apply/range_max': 9,
        })
      )
    ).filter((d) => d.ruleName === RULE);

    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]?.message).toContain('settings/0/apply/range_max');
  });

  it('leaves a negative setting index to the validator that already errors on it', () => {
    expectNoDiagnostic(
      scene(
        node('ConvertTransformModifier3D', {
          setting_count: 1,
          'settings/-1/apply/transform_mode': 1,
          'settings/-1/apply/range_max': 9,
        })
      ),
      { ruleName: RULE }
    );
  });

  it('lints its own fixture clean', () => {
    expectClean(readFixture('unit-convert-transform-modifier-3d.tscn'));
  });
});
