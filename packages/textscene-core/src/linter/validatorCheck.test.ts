/**
 * The slice-test apparatus's own assertions. `expectError` and `expectWarning`
 * state an ADR-0032 tier in a second file, since a validator derives its own
 * tier. Each case drives the helper through `toThrow`. Two LightmapGI probes
 * stand in for the two tiers, and the first case pins them.
 */

import { describe, it, expect } from 'vitest';
import {
  checkerFor,
  expectAccepted,
  expectError,
  expectRejected,
  expectWarning,
} from './testing/validatorCheck';
import './index.js'; // trigger all validator registrations

const check = checkerFor('LightmapGI');

/** `set_bounces` ERR_FAIL_CONDs past 16 (lightmap_gi.cpp), so it errors. */
const ENFORCED = () => check('bounces', '17');
/** `quality`'s enum ceiling is a bare assignment behind a hint, so it warns. */
const HINTED = () => check('quality', '4');

describe('checkerFor', () => {
  it('resolves the validator the linter would use, including an inherited one', () => {
    expect(check('bounces', '0')).toBeNull();
    // `layers` is VisualInstance3D's; the base-walk is part of what is reused.
    expect(check('layers', '1')).toBeNull();
  });

  it('fails on a property nothing validates, rather than reading as accepted', () => {
    expect(() => check('not_a_lightmapgi_property', 'anything')).toThrow(
      /no validator registered for LightmapGI\.not_a_lightmapgi_property/
    );
  });

  it('passes the line through to the diagnostic', () => {
    expect(check('bounces', '17', 42)?.line).toBe(42);
  });
});

describe('tier assertions', () => {
  it('the two probes carry the tiers every case below claims', () => {
    expect(ENFORCED()?.severity).toBe('error');
    expect(HINTED()?.severity).toBe('warning');
  });

  it("fails when 'error' is claimed and the validator only warns", () => {
    expect(() => expectError(HINTED(), 'Valid values')).toThrow();
  });

  it("fails when 'warning' is claimed and the validator errors", () => {
    expect(() => expectWarning(ENFORCED(), 'at most 16')).toThrow();
  });

  it('fails when the tier matches but the message does not name the bound', () => {
    // A same-tier refusal from a different arm of the same validator must not
    // satisfy a test titled after this bound.
    expect(() => expectError(ENFORCED(), 'must be finite')).toThrow(/must be finite/);
  });

  it('fails when the validator accepted the value', () => {
    expect(() => expectError(check('bounces', '16'), 'at most 16')).toThrow(
      /accepted the value/
    );
  });

  it('refuses an empty substring list, which would assert the tier alone', () => {
    expect(() => expectRejected(ENFORCED(), 'error', [])).toThrow(
      /does not identify the bound/
    );
  });

  it('passes, and returns the diagnostic, when tier and message both hold', () => {
    expect(expectError(ENFORCED(), 'at most 16', 'Godot does not store this value').severity).toBe(
      'error'
    );
    expect(expectWarning(HINTED(), 'Valid values').severity).toBe('warning');
  });
});

describe('expectAccepted', () => {
  it('passes on null and fails on a diagnostic, quoting what was said', () => {
    expectAccepted(check('bounces', '16'));
    expect(() => expectAccepted(ENFORCED())).toThrow(/at most 16/);
  });
});
