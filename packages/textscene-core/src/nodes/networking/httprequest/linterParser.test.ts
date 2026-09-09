/**
 * HTTPRequest strict validators — format and range checks.
 *
 * Asserted through `validatorRegistry` rather than by linting a `.tscn`: the
 * unit under test is the validator, so a failure points at the validator
 * instead of at scene parsing, and no fixture text has to be maintained
 * alongside it. Rule-level behaviour belongs in linter.test.ts, through `Linter`.
 *
 * Grow this into one case per property — happy, malformed, and any bound — and
 * quote the governing Godot source line beside every numeric bound.
 */

import { describe, expect, it } from 'vitest';
import { validatorRegistry } from '../../../linter/ValidatorRegistry';
import { expectFixtureClean } from '../../../linter/testing/fixtureCheck';
import './linterParser';

/** The error a validator returns for a value, or null when it accepts it. */
function check(property: string, value: string) {
  const validator = validatorRegistry.findValidator('HTTPRequest', property);
  expect(validator, `no validator registered for HTTPRequest.${property}`).not.toBeNull();
  return validator!(property, value, 1);
}

/**
 * Set exactly ONE, from the source rather than from expectation: list the keys
 * HTTPRequest binds, or set DECLARES_NOTHING when it binds no ADD_PROPERTY at all.
 * Leaving both unset is red on purpose. Do NOT delete an assertion to go green.
 */
const KEYS: string[] = [
  'accept_gzip',
  'body_size_limit',
  'download_chunk_size',
  'download_file',
  'max_redirects',
  'timeout',
  'use_threads',
];
/** True only when the class binds NO ADD_PROPERTY. Say which source line proves it. */
const DECLARES_NOTHING = false;

/**
 * Keys HTTPRequest does NOT declare, each paired with the ancestor that does.
 * Name at least one; Node is where to start.
 *
 * This is the assertion the malformed-value sweep below CANNOT make. That sweep
 * iterates `getOwnKeys`, so on a class that rightly declares nothing it sweeps
 * an EMPTY set and passes while asserting nothing — "Godot gives HTTPRequest no
 * properties of its own" and "nobody has written this slice yet" look identical
 * to it. Resolving a key through the base-walk to the ancestor's own validator
 * function tells the two apart, and it is red until filled for the same reason
 * KEYS is.
 */
const INHERITED: [owner: string, key: string][] = [['Node', 'process_mode']];

describe('HTTPRequest strict validators', () => {
  it('registers exactly what HTTPRequest binds', () => {
    expect(
      DECLARES_NOTHING || KEYS.length > 0,
      'fill KEYS from the ADD_PROPERTY calls, or set DECLARES_NOTHING with the source line that proves it'
    ).toBe(true);
    expect(validatorRegistry.getOwnKeys('HTTPRequest').sort()).toEqual([...KEYS].sort());
  });

  it('accepts every value its own fixture carries', () => {
    // The fixture's "zero errors and zero warnings" claim, RUN rather than
    // reasoned. `fixtureLint` owns the whole-registry version but needs the
    // barrel, so it cannot run while sibling slices are being written; this
    // checks the same file against whatever this test imported.
    expectFixtureClean('unit-http-request.tscn');
  });

  it('rejects a malformed value on every property it validates', () => {
    // A validator that accepts arbitrary prose is not validating a format. The
    // sweep is generic on purpose; per-property cases come next. Vacuous when
    // HTTPRequest declares nothing, which is what INHERITED below covers.
    const accepted = validatorRegistry
      .getOwnKeys('HTTPRequest')
      .filter((property) => check(property, 'definitely-not-a-valid-value') === null);
    expect(accepted).toEqual([]);
  });

  it('resolves each inherited key to the ancestor that declares it', () => {
    expect(
      INHERITED.length,
      'name at least one key HTTPRequest inherits, and the ancestor that declares it'
    ).toBeGreaterThan(0);
    for (const [owner, key] of INHERITED) {
      const owned = validatorRegistry.findValidator(owner, key);
      expect(owned, `${owner} does not declare '${key}'`).not.toBeNull();
      // The SAME function, not merely some validator: a shadowing copy on
      // HTTPRequest would answer here while drifting from the ancestor's rule.
      expect(validatorRegistry.findValidator('HTTPRequest', key)).toBe(owned);
      expect(validatorRegistry.getOwnKeys('HTTPRequest')).not.toContain(key);
    }
  });

  it('accepts boolean literals and rejects anything else', () => {
    for (const key of ['accept_gzip', 'use_threads']) {
      expect(check(key, 'true')).toBeNull();
      expect(check(key, 'false')).toBeNull();
      expect(check(key, 'yes')).not.toBeNull();
    }
  });

  it('warns body_size_limit outside -1..2000000000 (hinted, not enforced)', () => {
    expect(check('body_size_limit', '-1')).toBeNull();
    expect(check('body_size_limit', '0')).toBeNull();
    expect(check('body_size_limit', '2000000000')).toBeNull();
    const tooLow = check('body_size_limit', '-2');
    expect(tooLow?.severity).toBe('warning');
    const tooHigh = check('body_size_limit', '2000000001');
    expect(tooHigh?.severity).toBe('warning');
  });

  it('errors download_chunk_size outside 256..16777216 (setter-enforced)', () => {
    expect(check('download_chunk_size', '256')).toBeNull();
    expect(check('download_chunk_size', '16777216')).toBeNull();
    const tooLow = check('download_chunk_size', '255');
    expect(tooLow?.severity).toBe('error');
    const tooHigh = check('download_chunk_size', '16777217');
    expect(tooHigh?.severity).toBe('error');
  });

  it('requires download_file to be a quoted string', () => {
    expect(check('download_file', '"res://downloads/file.zip"')).toBeNull();
    expect(check('download_file', 'unquoted')).not.toBeNull();
  });

  it('warns max_redirects outside -1..64 (hinted, not enforced)', () => {
    expect(check('max_redirects', '-1')).toBeNull();
    expect(check('max_redirects', '64')).toBeNull();
    expect(check('max_redirects', '-2')?.severity).toBe('warning');
    expect(check('max_redirects', '65')?.severity).toBe('warning');
  });

  it('errors a negative timeout (setter-enforced floor) with no upper bound', () => {
    expect(check('timeout', '0')).toBeNull();
    expect(check('timeout', '3600')).toBeNull();
    expect(check('timeout', '999999')).toBeNull();
    expect(check('timeout', '-0.1')?.severity).toBe('error');
  });
});
