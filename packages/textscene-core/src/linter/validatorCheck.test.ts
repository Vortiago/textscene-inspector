/**
 * The slice-test apparatus's own assertions.
 *
 * `expectError` / `expectWarning` are what put an ADR-0032 tier claim in a
 * second file: the tier itself is derived inside the validator from its own
 * `enforced:` / `hinted:` declaration, so a flipped one stays self-consistent
 * and every registry-wide guard agrees with it. The required message substring
 * is the part that cannot agree with itself.
 *
 * Every case below drives the helper through `toThrow`, because an `it` that
 * should have failed cannot be caught from outside — the same reason
 * `testkit.severity.test.ts` exists for the scene-level kit.
 *
 * Two honest LightmapGI diagnostics stand in for the two tiers, pinned by the
 * first case so a `toThrow` can never pass merely because nothing was rejected.
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

/** `set_bounces` ERR_FAIL_CONDs past 16 (lightmap_gi.cpp) — errors. */
const ENFORCED = () => check('bounces', '17');
/** `quality`'s enum ceiling is a bare assignment behind a hint — warns. */
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
    // The whole point: a same-tier refusal from a DIFFERENT arm of the same
    // validator must not satisfy a test titled after this bound.
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
    expect(expectError(ENFORCED(), 'at most 16', "Godot's setter refuses the write").severity).toBe(
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
