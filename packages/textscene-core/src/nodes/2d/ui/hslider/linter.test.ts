/**
 * HSlider property-order rule.
 *
 * `Range::set_min`/`set_max`/`set_page` (`scene/gui/range.cpp:211-226`,
 * `:228-241`, `:254-266`) each end by calling `set_value(shared->val)`,
 * re-clamping the CURRENT `value` against whatever `min`/`max`/`page` are at
 * that moment (`_calc_value`, `:182-200`). `min_value`, `max_value`, `page`,
 * and `value` are all independently `.tscn`-serializable
 * (`range.cpp:405,406,408,409` — no `PROPERTY_USAGE_EDITOR`-only restriction,
 * unlike `Node3D`'s decomposed transform properties). Traced by hand against
 * the struct defaults (`min=0.0`, `max=100.0`, `page=0.0`,
 * `allow_greater`/`allow_lesser` both `false` — `range.h:39-46`): a `.tscn`
 * that writes `value = 150` BEFORE `min_value = 0` / `max_value = 200` clamps
 * `value` against the still-default `max = 100` the instant `value`'s own
 * setter runs (`!allow_greater && 150 > 100-0` → clamps to `100`), and the
 * later `min_value`/`max_value` lines only re-clamp the ALREADY-corrupted
 * `100` into the new range — they never recover the authored `150`. The same
 * three lines in the editor's own order (`min_value`, `max_value`, `value`)
 * land at the correct `150`. Measured by hand from source, not from a Godot
 * render — see ADR-0035.
 */

import { describe, it, expect } from 'vitest';
import { node, scene, expectClean, expectDiagnostic, expectNoDiagnostic } from '../../../../linter/testing/testkit';
import './linter';

describe('HSlider property-order rule', () => {
  it('warns when value is authored before min_value/max_value — Range re-clamps it against stale defaults', () => {
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
