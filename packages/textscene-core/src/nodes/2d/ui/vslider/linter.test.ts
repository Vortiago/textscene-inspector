/**
 * VSlider property-order rule — same mechanism as HSlider's (both are plain
 * `Range → Slider` leaves; see `hslider/linter.test.ts` for the full
 * `range.cpp` derivation and citations).
 */

import { describe, it } from 'vitest';
import { node, scene, expectClean, expectDiagnostic, expectNoDiagnostic } from '../../../../linter/testing/testkit';
import './linter';

describe('VSlider property-order rule', () => {
  it('warns when value is authored before min_value/max_value — Range re-clamps it against stale defaults', () => {
    const content = scene(
      node('VSlider', {
        layout_mode: 1,
        value: 150,
        min_value: 0,
        max_value: 200,
      })
    );
    expectDiagnostic(content, {
      ruleName: 'vslider-property-order',
      severity: 'warning',
      contains: ['value', 'min_value', 'max_value'],
    });
  });

  it('warns when value is authored before page alone', () => {
    const content = scene(
      node('VSlider', {
        layout_mode: 1,
        value: 50,
        page: 10,
      })
    );
    expectDiagnostic(content, {
      ruleName: 'vslider-property-order',
      contains: ['value', 'page'],
    });
  });

  it('is clean when value is authored after min_value/max_value/page — Godot parity order', () => {
    expectClean(
      scene(
        node('VSlider', {
          layout_mode: 1,
          min_value: 0,
          max_value: 200,
          page: 10,
          value: 150,
        })
      )
    );
  });

  it('stays silent with no value authored at all', () => {
    expectNoDiagnostic(
      scene(
        node('VSlider', {
          layout_mode: 1,
          min_value: 0,
          max_value: 200,
        })
      ),
      { ruleName: 'vslider-property-order' }
    );
  });

  it('stays silent when neither min_value, max_value, nor page is authored', () => {
    expectNoDiagnostic(
      scene(
        node('VSlider', {
          layout_mode: 1,
          value: 60,
        })
      ),
      { ruleName: 'vslider-property-order' }
    );
  });
});
