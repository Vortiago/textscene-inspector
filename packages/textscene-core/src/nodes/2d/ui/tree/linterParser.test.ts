/**
 * Tree strict validators: format and range checks.
 *
 * Asserted through `validatorRegistry` rather than by linting a `.tscn`: the
 * unit under test is the validator, so a failure points at the validator
 * instead of at scene parsing, and no fixture text has to be maintained
 * alongside it. Rule-level behaviour belongs in linter.test.ts.
 *
 * Grouped as linterParser.ts groups them, which is `_bind_methods` order: the
 * four typed members get a describe each, and the twelve booleans share one
 * parameterised block rather than twelve near-identical copies. Every numeric
 * or enum bound quotes the governing Godot source line.
 */

import { describe, expect, it } from 'vitest';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry';
import { expectFixtureClean } from '../../../../linter/testing/fixtureCheck';
import './linterParser';

/** The error a validator returns for a value, or null when it accepts it. */
function check(property: string, value: string) {
  const validator = validatorRegistry.findValidator('Tree', property);
  expect(validator, `no validator registered for Tree.${property}`).not.toBeNull();
  return validator!(property, value, 1);
}

/**
 * Every plain boolean Tree binds, in `_bind_methods` order (tree.cpp:6808-6823).
 * No setter among them rejects or alters a value, so all twelve are format-only.
 */
const BOOLEAN_PROPERTIES = [
  'column_titles_visible',
  'allow_reselect',
  'allow_rmb_select',
  'allow_search',
  'hide_folding',
  'enable_recursive_folding',
  'enable_drag_unfolding',
  'hide_root',
  'auto_tooltip',
  'scroll_horizontal_enabled',
  'scroll_vertical_enabled',
  'tile_scroll_hint',
];

/**
 * Set exactly ONE, from the source rather than from expectation: list the keys
 * Tree binds, or set DECLARES_NOTHING when it binds no ADD_PROPERTY at all.
 * Leaving both unset is red on purpose. Do NOT delete an assertion to go green.
 */
const KEYS: string[] = [
  'columns',
  'select_mode',
  'scroll_hint_mode',
  'drop_mode_flags',
  ...BOOLEAN_PROPERTIES,
];
/** True only when the class binds NO ADD_PROPERTY. Say which source line proves it. */
const DECLARES_NOTHING = false;

describe('Tree strict validators', () => {
  it('registers exactly what Tree binds', () => {
    expect(
      DECLARES_NOTHING || KEYS.length > 0,
      'fill KEYS from the ADD_PROPERTY calls, or set DECLARES_NOTHING with the source line that proves it'
    ).toBe(true);
    expect(validatorRegistry.getOwnKeys('Tree').sort()).toEqual([...KEYS].sort());
  });

  it('registers all 16 of Tree own members (doc/classes/Tree.xml minus the 2 overrides=)', () => {
    expect(validatorRegistry.getOwnKeys('Tree')).toHaveLength(16);
  });

  it('never re-declares clip_contents or focus_mode (overrides="Control", owned by the ancestor)', () => {
    // doc/classes/Tree.xml:362 and :379 mark both `overrides="Control"`, and
    // tree.cpp's ADD_PROPERTY run (tree.cpp:6807-6823) re-declares neither, so
    // both validators belong to Control and would be shadowed here.
    expect(validatorRegistry.getOwnKeys('Tree')).not.toContain('clip_contents');
    expect(validatorRegistry.getOwnKeys('Tree')).not.toContain('focus_mode');
  });

  it('declares nothing for TreeItem state, which is built at runtime and never serialised', () => {
    // TreeItem is an Object, not a Node, so it gets no `[node]` heading and its
    // own four ADD_PROPERTY bindings (tree.cpp:1969-1972) land on TreeItem, not
    // on Tree. A `.tscn` carrying `text` or `collapsed` under a Tree heading is
    // setting something Tree does not have.
    for (const treeItemKey of ['collapsed', 'visible', 'disable_folding', 'custom_minimum_height']) {
      expect(validatorRegistry.getOwnKeys('Tree')).not.toContain(treeItemKey);
    }
  });

  it('accepts every value its own fixture carries', () => {
    // The fixture's "zero errors and zero warnings" claim, RUN rather than
    // reasoned. `fixtureLint` owns the whole-registry version but needs the
    // barrel, so it cannot run while sibling slices are being written; this
    // checks the same file against whatever this test imported.
    expectFixtureClean('unit-tree.tscn');
  });

  it('rejects a malformed value on every property it validates', () => {
    // A validator that accepts arbitrary prose is not validating a format. The
    // sweep is generic on purpose; per-property cases come next.
    const accepted = validatorRegistry
      .getOwnKeys('Tree')
      .filter((property) => check(property, 'definitely-not-a-valid-value') === null);
    expect(accepted).toEqual([]);
  });

  describe('columns', () => {
    it('accepts the default single column', () => {
      expect(check('columns', '1')).toBeNull();
    });

    it('accepts a multi-column tree', () => {
      expect(check('columns', '3')).toBeNull();
    });

    it('errors on zero columns, which set_columns refuses outright', () => {
      // tree.cpp:5716 `ERR_FAIL_COND(p_columns < 1)`.
      const error = check('columns', '0');
      expect(error?.severity).toBe('error');
      expect(error?.message).toContain('columns');
    });

    it('errors on a negative column count', () => {
      expect(check('columns', '-2')?.severity).toBe('error');
    });

    it('accepts an absurdly wide tree, because the ADD_PROPERTY carries no hint', () => {
      // tree.cpp:6807 is a bare `PropertyInfo(Variant::INT, "columns")`: no
      // PROPERTY_HINT_RANGE, so the max end is open and never diagnoses.
      expect(check('columns', '4096')).toBeNull();
    });

    it('rejects a non-numeric value as a format error', () => {
      const error = check('columns', 'many');
      expect(error?.severity).toBe('error');
      expect(error?.code).toBe('INVALID_COLUMNS_FORMAT');
    });
  });

  describe('select_mode', () => {
    it.each(['0', '1', '2'])('accepts %s, one of the three bound constants', (value) => {
      expect(check('select_mode', value)).toBeNull();
    });

    it('warns rather than errors past the last constant', () => {
      // The hint lists exactly three entries (tree.cpp:6817) but
      // Tree::set_select_mode is a bare assignment (tree.cpp:5403-5405), so a
      // wider value loads unaltered: a UI-control hint, hence warning.
      const error = check('select_mode', '3');
      expect(error?.severity).toBe('warning');
      expect(error?.message).toContain('SELECT_MULTI');
    });

    it('warns below the first constant', () => {
      expect(check('select_mode', '-1')?.severity).toBe('warning');
    });

    it('rejects a symbolic name as a format error', () => {
      expect(check('select_mode', 'SELECT_MULTI')?.severity).toBe('error');
    });
  });

  describe('scroll_hint_mode', () => {
    it.each(['0', '1', '2', '3'])('accepts %s, one of the four bound constants', (value) => {
      expect(check('scroll_hint_mode', value)).toBeNull();
    });

    it('warns rather than errors past the last constant', () => {
      // Four-entry hint at tree.cpp:6822; Tree::set_scroll_hint_mode
      // (tree.cpp:6086-6093) only early-returns on an unchanged value and then
      // assigns, so a wider value is stored as written.
      const error = check('scroll_hint_mode', '4');
      expect(error?.severity).toBe('warning');
      expect(error?.message).toContain('SCROLL_HINT_MODE_BOTTOM');
    });

    it('warns below the first constant', () => {
      expect(check('scroll_hint_mode', '-1')?.severity).toBe('warning');
    });

    it('rejects a symbolic name as a format error', () => {
      expect(check('scroll_hint_mode', 'SCROLL_HINT_MODE_TOP')?.severity).toBe('error');
    });
  });

  describe('drop_mode_flags', () => {
    it.each([
      ['0', 'DROP_MODE_DISABLED'],
      ['1', 'DROP_MODE_ON_ITEM'],
      ['2', 'DROP_MODE_INBETWEEN'],
      ['3', 'both bits at once'],
    ])('accepts %s (%s)', (value) => {
      expect(check('drop_mode_flags', value)).toBeNull();
    });

    it('warns rather than errors on a bit the flag list does not offer', () => {
      // Tree::set_drop_mode_flags (tree.cpp:6653-6663) assigns p_flags with no
      // `& MASK`, so 4 is STORED, not dropped. That is the whole reason this is
      // not a maskedBitField: only the two-entry PROPERTY_HINT_FLAGS at
      // tree.cpp:6816 excludes it, and a UI hint grounds a warning.
      const error = check('drop_mode_flags', '4');
      expect(error?.severity).toBe('warning');
      expect(error?.message).toContain('drop_mode_flags');
    });

    it('warns on a negative mask', () => {
      expect(check('drop_mode_flags', '-1')?.severity).toBe('warning');
    });

    it('rejects a non-numeric mask as a format error', () => {
      expect(check('drop_mode_flags', 'On Item')?.severity).toBe('error');
    });
  });

  describe.each(BOOLEAN_PROPERTIES)('%s (boolean)', (property) => {
    it('accepts true', () => {
      expect(check(property, 'true')).toBeNull();
    });

    it('accepts false', () => {
      expect(check(property, 'false')).toBeNull();
    });

    it('rejects the integer spelling Godot never writes for a BOOL', () => {
      expect(check(property, '1')?.severity).toBe('error');
    });

    it('rejects a capitalised spelling', () => {
      expect(check(property, 'True')?.severity).toBe('error');
    });
  });
});
