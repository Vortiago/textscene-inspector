/**
 * MultiplayerSpawner strict validators: format and range checks, asserted through `validatorRegistry` rather
 * than by linting a `.tscn`, so a failure points at the validator. Rule-level behaviour belongs in
 * linter.test.ts. Each numeric bound quotes the governing Godot source line beside it.
 */

import { describe, expect, it } from 'vitest';
import { validatorRegistry } from '../../../linter/ValidatorRegistry';
import { expectFixtureClean } from '../../../linter/testing/fixtureCheck';
import './linterParser';

/** The error a validator returns for a value, or null when it accepts it. */
function check(property: string, value: string) {
  const validator = validatorRegistry.findValidator('MultiplayerSpawner', property);
  expect(validator, `no validator registered for MultiplayerSpawner.${property}`).not.toBeNull();
  return validator!(property, value, 1);
}

/**
 * Set exactly one, from the source rather than from expectation: list the keys
 * MultiplayerSpawner binds, or set DECLARES_NOTHING when it binds no ADD_PROPERTY at all.
 * Leaving both unset fails on purpose. Do not delete an assertion to pass.
 */
const KEYS: string[] = ['_spawnable_scenes', 'spawn_path', 'spawn_limit'];
/** True only when the class binds no ADD_PROPERTY. Say which source line proves it. */
const DECLARES_NOTHING = false;

/**
 * Keys MultiplayerSpawner does not declare, each paired with the ancestor that does. The malformed-value
 * sweep iterates `getOwnKeys`, so on a class that declares nothing it passes vacuously. Resolving a
 * key through the base walk to the ancestor's own validator tells "declares nothing" from "not written".
 */
const INHERITED: [owner: string, key: string][] = [['Node', 'process_mode']];

describe('_spawnable_scenes padding', () => {
  it('accepts whitespace before the paren, as its FileDialog.filters twin does', () => {
    // The type name and `(` are separate tokens; `get_token` discards every
    // character <= 32 before one (variant_parser.cpp:416-418).
    const v = validatorRegistry.findValidator('MultiplayerSpawner', '_spawnable_scenes')!;
    expect(v('_spawnable_scenes', 'PackedStringArray ("res://a.tscn")', 1)).toBeNull();
    expect(v('_spawnable_scenes', 'PackedStringArray\t("res://a.tscn")', 1)).toBeNull();
    expect(v('_spawnable_scenes', 'PackedStringArray(unquoted)', 1)).not.toBeNull();
  });
});

describe('MultiplayerSpawner strict validators', () => {
  it('registers exactly what MultiplayerSpawner binds', () => {
    expect(
      DECLARES_NOTHING || KEYS.length > 0,
      'fill KEYS from the ADD_PROPERTY calls, or set DECLARES_NOTHING with the source line that proves it'
    ).toBe(true);
    expect(validatorRegistry.getOwnKeys('MultiplayerSpawner').sort()).toEqual([...KEYS].sort());
  });

  it('accepts every value its own fixture carries', () => {
    // The fixture's "zero errors and zero warnings" claim, run rather than
    // reasoned. `fixtureLint` owns the whole-registry version through the
    // barrel. This checks the same file against whatever this test imported.
    expectFixtureClean('unit-multiplayer-spawner.tscn');
  });

  it('rejects a malformed value on every property it validates', () => {
    // A validator that accepts arbitrary prose is not validating a format. The
    // sweep is generic on purpose. It is vacuous when MultiplayerSpawner declares
    // nothing, which INHERITED covers.
    const accepted = validatorRegistry
      .getOwnKeys('MultiplayerSpawner')
      .filter((property) => check(property, 'definitely-not-a-valid-value') === null);
    expect(accepted).toEqual([]);
  });

  it('resolves each inherited key to the ancestor that declares it', () => {
    expect(
      INHERITED.length,
      'name at least one key MultiplayerSpawner inherits, and the ancestor that declares it'
    ).toBeGreaterThan(0);
    for (const [owner, key] of INHERITED) {
      const owned = validatorRegistry.findValidator(owner, key);
      expect(owned, `${owner} does not declare '${key}'`).not.toBeNull();
      // The same function, not merely some validator: a shadowing copy on
      // MultiplayerSpawner would answer here while drifting from the ancestor's rule.
      expect(validatorRegistry.findValidator('MultiplayerSpawner', key)).toBe(owned);
      expect(validatorRegistry.getOwnKeys('MultiplayerSpawner')).not.toContain(key);
    }
  });

  it('accepts a NodePath literal for spawn_path and rejects a bare string', () => {
    expect(check('spawn_path', 'NodePath("SpawnRoot")')).toBeNull();
    expect(check('spawn_path', 'NodePath("")')).toBeNull();
    expect(check('spawn_path', 'SpawnRoot')).not.toBeNull();
  });

  it('warns spawn_limit below 0 (hinted, bare uint32_t setter) with no upper bound', () => {
    expect(check('spawn_limit', '0')).toBeNull();
    expect(check('spawn_limit', '1024')).toBeNull();
    expect(check('spawn_limit', '999999')).toBeNull();
    expect(check('spawn_limit', '-1')?.severity).toBe('warning');
  });

  it('accepts the typed and bare spellings the slot converts', () => {
    // `can_convert_strict` accepts ARRAY for PACKED_STRING_ARRAY (variant.cpp:467-473), and
    // `_set_spawnable_scenes` (multiplayer_spawner.cpp:146) takes the converted `Vector<String>`.
    // The getter writes only the packed form, which bounds nothing a hand-authored file follows.
    expect(check('_spawnable_scenes', 'Array[String](["res://a.tscn"])')).toBeNull();
    expect(check('_spawnable_scenes', '["res://a.tscn", "res://b.tscn"]')).toBeNull();
    expect(check('_spawnable_scenes', '[]')).toBeNull();
  });

  it('accepts an empty and a populated _spawnable_scenes array', () => {
    expect(check('_spawnable_scenes', 'PackedStringArray()')).toBeNull();
    expect(check('_spawnable_scenes', 'PackedStringArray("res://enemy.tscn")')).toBeNull();
    expect(
      check('_spawnable_scenes', 'PackedStringArray("res://enemy.tscn", "uid://abc123")')
    ).toBeNull();
    expect(check('_spawnable_scenes', 'not-a-packed-array')).not.toBeNull();
  });

  it('accepts one trailing comma, which the packed loop closes on', () => {
    expect(check('_spawnable_scenes', 'PackedStringArray("res://a.tscn",)')).toBeNull();
    expect(check('_spawnable_scenes', '["res://a.tscn",]')).toBeNull();
  });
});
