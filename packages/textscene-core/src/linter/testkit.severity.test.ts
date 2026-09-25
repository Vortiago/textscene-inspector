/**
 * The test-kit's own severity plumbing. `InvalidCase.severity` states an
 * ADR-0032 tier, and a dropped field passes silently, so a mismatched severity
 * must throw. Two Camera2D diagnostics stand in for the two tiers, and the
 * first test pins them so a `toThrow` never passes on a missing diagnostic.
 */

import { describe, it, expect } from 'vitest';
import { expectDiagnostic, expectInvalidCase, lint, node, scene } from './testing/testkit';
import './index.js'; // trigger all validator + rule registrations

/** drag_left_margin's 0..1 bound is a PROPERTY_HINT_RANGE (camera_2d.cpp:989), so it warns. */
const HINTED_WARNING = scene(node('Camera2D', { drag_left_margin: 1.5 }));
/** set_zoom ERR_FAIL_CONDs on a near-zero component (camera_2d.cpp:103-105), so it errors. */
const ENFORCED_ERROR = scene(node('Camera2D', { zoom: 'Vector2(0, 1)' }));

function severityOf(content: string, prop: string): string | undefined {
  return lint(content).find(d => d.message.includes(prop))?.severity;
}

describe('test-kit severity assertions', () => {
  it('the two scenes carry the tiers every case below claims', () => {
    expect(severityOf(HINTED_WARNING, 'drag_left_margin')).toBe('warning');
    expect(severityOf(ENFORCED_ERROR, 'zoom')).toBe('error');
  });

  it("fails when 'error' is claimed and the diagnostic only warns", () => {
    expect(() =>
      expectDiagnostic(HINTED_WARNING, { prop: 'drag_left_margin', severity: 'error' })
    ).toThrow(/warning/);
  });

  it("fails when 'warning' is claimed and the diagnostic errors", () => {
    expect(() => expectDiagnostic(ENFORCED_ERROR, { prop: 'zoom', severity: 'warning' })).toThrow(
      /error/
    );
  });

  it('passes when the claimed tier matches the diagnostic', () => {
    expect(
      expectDiagnostic(HINTED_WARNING, { prop: 'drag_left_margin', severity: 'warning' }).severity
    ).toBe('warning');
    expect(expectDiagnostic(ENFORCED_ERROR, { prop: 'zoom', severity: 'error' }).severity).toBe(
      'error'
    );
  });

  it('is additive: omitting severity passes against either tier', () => {
    expect(expectDiagnostic(HINTED_WARNING, { prop: 'drag_left_margin' }).severity).toBe('warning');
    expect(expectDiagnostic(ENFORCED_ERROR, { prop: 'zoom' }).severity).toBe('error');
  });
});

describe('InvalidCase.severity forwarding', () => {
  it("forwards a mismatched 'error' claim, so the reject case fails", () => {
    expect(() =>
      expectInvalidCase(HINTED_WARNING, 'drag_left_margin', { value: 1.5, severity: 'error' })
    ).toThrow(/warning/);
  });

  it("forwards a mismatched 'warning' claim, so the reject case fails", () => {
    expect(() =>
      expectInvalidCase(ENFORCED_ERROR, 'zoom', { value: 'Vector2(0, 1)', severity: 'warning' })
    ).toThrow(/error/);
  });

  it('forwards a matching claim, which passes and returns the diagnostic', () => {
    expect(
      expectInvalidCase(HINTED_WARNING, 'drag_left_margin', { value: 1.5, severity: 'warning' })
        .severity
    ).toBe('warning');
    expect(
      expectInvalidCase(ENFORCED_ERROR, 'zoom', { value: 'Vector2(0, 1)', severity: 'error' })
        .severity
    ).toBe('error');
  });

  it('leaves a case that declares no severity asserting nothing about the tier', () => {
    expect(
      expectInvalidCase(HINTED_WARNING, 'drag_left_margin', { value: 1.5 }).severity
    ).toBe('warning');
    expect(expectInvalidCase(ENFORCED_ERROR, 'zoom', { value: 'Vector2(0, 1)' }).severity).toBe(
      'error'
    );
  });

  it('still forwards ruleName and contains beside the severity', () => {
    expect(() =>
      expectInvalidCase(HINTED_WARNING, 'drag_left_margin', {
        value: 1.5,
        contains: ['no diagnostic says this'],
      })
    ).toThrow();
    expect(() =>
      expectInvalidCase(HINTED_WARNING, 'drag_left_margin', {
        value: 1.5,
        ruleName: 'not-a-rule',
      })
    ).toThrow();
  });
});
