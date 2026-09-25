/**
 * HSlider property-order rule. `Range::set_min`/`set_max`/`set_page`
 * (`scene/gui/range.cpp:211-226`, `:228-241`, `:254-266`) each end in
 * `set_value(shared->val)`, which re-clamps `value` (`_calc_value`, `:182-200`).
 * All four keys serialise (`range.cpp:405,406,408,409`). Traced from source (ADR-0035).
 */

import { describe, it, expect } from 'vitest';
import { node, scene, expectClean, expectDiagnostic, expectNoDiagnostic } from '../../../../linter/testing/testkit';
import './linter';

describe('HSlider property-order rule', () => {
  it('warns when value is authored before min_value/max_value — Range re-clamps it against stale defaults', () => {
    // Defaults min 0, max 100, page 0, no allow_greater/allow_lesser (`range.h:39-46`):
    // `value = 150` clamps to 100 at once (`150 > 100-0`), and the later bounds only
    // re-clamp that 100. The editor's order (`min_value`, `max_value`, `value`) keeps 150.
    const content = scene(
      node('HSlider', {
        layout_mode: 1,
        value: 150,
        min_value: 0,
        max_value: 200,
      })
    );
    expectDiagnostic(content, {
      ruleName: 'hslider-property-order',
      severity: 'warning',
      contains: ['value', 'min_value', 'max_value'],
    });
  });

  it('warns when value sits between min_value and max_value — max_value still re-clamps it', () => {
    const content = scene(
      node('HSlider', {
        layout_mode: 1,
        min_value: 0,
        value: 150,
        max_value: 200,
      })
    );
    const diag = expectDiagnostic(content, { ruleName: 'hslider-property-order' });
    expect(diag.message).toContain('value');
    expect(diag.message).toContain('max_value');
  });

  it('warns when value is authored before page alone', () => {
    const content = scene(
      node('HSlider', {
        layout_mode: 1,
        value: 50,
        page: 10,
      })
    );
    expectDiagnostic(content, {
      ruleName: 'hslider-property-order',
      contains: ['value', 'page'],
    });
  });

  it('is clean when value is authored after min_value/max_value/page — Godot parity order', () => {
    expectClean(
      scene(
        node('HSlider', {
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
        node('HSlider', {
          layout_mode: 1,
          min_value: 0,
          max_value: 200,
        })
      ),
      { ruleName: 'hslider-property-order' }
    );
  });

  it('stays silent when neither min_value, max_value, nor page is authored', () => {
    expectNoDiagnostic(
      scene(
        node('HSlider', {
          layout_mode: 1,
          value: 60,
        })
      ),
      { ruleName: 'hslider-property-order' }
    );
  });
});
