/**
 * The test kit's tier-narrowed negatives. "No diagnostic at this tier" cannot
 * fail once the rule stops reporting at that tier, so the kit refuses a negative
 * at a tier that no declared arm can reach.
 */

import { describe, it, expect } from 'vitest';
import { expectNoDiagnostic, expectNoErrors, node, scene } from './testing/testkit';
import './index.js'; // trigger all validator + rule registrations

/** drag_left_margin's 0..1 bound is a PROPERTY_HINT_RANGE (camera_2d.cpp:989), so it warns. */
const HINTED_WARNING = scene(node('Camera2D', { drag_left_margin: 1.5 }));
/** set_zoom refuses a near-zero component with ERR_FAIL_COND (camera_2d.cpp:103-105), so it errors. */
const ENFORCED_ERROR = scene(node('Camera2D', { zoom: 'Vector2(0, 1)' }));
const CLEAN = scene(node('Node2D'));

describe('a negative narrowed to a tier', () => {
  it('passes over a diagnostic at another tier, so a hinted bound is not an error', () => {
    expectNoDiagnostic(HINTED_WARNING, { prop: 'drag_left_margin', severity: 'error' });
  });

  it('fails while a diagnostic at the named tier is present', () => {
    expect(() => expectNoDiagnostic(ENFORCED_ERROR, { prop: 'zoom', severity: 'error' })).toThrow();
  });

  it('refuses a tier the named rule declares no arm for, since it cannot fail', () => {
    expect(() =>
      expectNoDiagnostic(CLEAN, { ruleName: 'binary-resource-reference', severity: 'error' })
    ).toThrow("'binary-resource-reference' declares no error arm");
  });

  it('refuses a rule name that nothing declares', () => {
    expect(() => expectNoDiagnostic(CLEAN, { ruleName: 'no-such-rule', severity: 'info' })).toThrow(
      "'no-such-rule' declares no info arm"
    );
  });

  it('refuses a warning located by message alone, which names no rule', () => {
    expect(() => expectNoDiagnostic(HINTED_WARNING, { prop: 'zoom', severity: 'warning' })).toThrow(
      'name the rule'
    );
  });

  it("reads a file diagnostic's declared arm like a rule's", () => {
    expectNoDiagnostic(CLEAN, { ruleName: 'legacy-format-version', severity: 'info' });
  });

  it('applies the same refusal to expectNoErrors', () => {
    expect(() => expectNoErrors(CLEAN, { ruleName: 'binary-resource-reference' })).toThrow(
      "'binary-resource-reference' declares no error arm"
    );
  });
});
