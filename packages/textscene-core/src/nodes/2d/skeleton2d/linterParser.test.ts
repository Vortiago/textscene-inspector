/**
 * Skeleton2D strict validators — format and range checks.
 *
 * Asserted through `validatorRegistry` rather than by linting a `.tscn`: the
 * unit under test is the validator, so a failure points at the validator
 * instead of at scene parsing, and no fixture text has to be maintained
 * alongside it. Rule-level behaviour belongs in linter.test.ts, through `Linter`.
 */

import { describe, expect, it } from 'vitest';
import { validatorRegistry } from '../../../linter/ValidatorRegistry';
import { expectFixtureClean } from '../../../linter/testing/fixtureCheck';
import './linterParser';

/** The error a validator returns for a value, or null when it accepts it. */
function check(property: string, value: string) {
  const validator = validatorRegistry.declarationFor('Skeleton2D', property);
  expect(validator, `no validator registered for Skeleton2D.${property}`).not.toBeNull();
  return validator!(property, value, 1);
}

/**
 * Skeleton2D binds ZERO `ADD_PROPERTY`: `_bind_methods`
 * (skeleton_2d.cpp:817-831) is seven `bind_method`s and one `ADD_SIGNAL`. Its
 * one serialised key arrives through the fourth route instead — a hand-rolled
 * property-list override, `_set`/`_get`/`_get_property_list`
 * (skeleton_2d.cpp:514/522/530), whose single `PropertyInfo` is
 * `modification_stack`. No `PropertyListHelper`, no `register_property`, no
 * `ADD_ARRAY_COUNT`.
 */
const KEYS: string[] = ['modification_stack'];
/** True only when the class binds NO ADD_PROPERTY. Say which source line proves it. */
const DECLARES_NOTHING = false;

describe('Skeleton2D strict validators', () => {
  it('registers exactly what Skeleton2D binds', () => {
    expect(
      DECLARES_NOTHING || KEYS.length > 0,
      'fill KEYS from the ADD_PROPERTY calls, or set DECLARES_NOTHING with the source line that proves it'
    ).toBe(true);
    expect(validatorRegistry.getOwnKeys('Skeleton2D').sort()).toEqual([...KEYS].sort());
  });

  it('accepts every value its own fixture carries', () => {
    // The fixture's "zero errors and zero warnings" claim, RUN rather than
    // reasoned. `fixtureLint` owns the whole-registry version but needs the
    // barrel, so it cannot run while sibling slices are being written; this
    // checks the same file against whatever this test imported.
    expectFixtureClean('unit-skeleton-2d.tscn');
  });

  it('rejects a malformed value on every property it validates', () => {
    // A validator that accepts arbitrary prose is not validating a format. The
    // sweep is generic on purpose; per-property cases come next.
    const accepted = validatorRegistry
      .getOwnKeys('Skeleton2D')
      .filter((property) => check(property, 'definitely-not-a-valid-value') === null);
    expect(accepted).toEqual([]);
  });

  describe('modification_stack', () => {
    it('accepts the SubResource form Godot writes for an in-scene stack', () => {
      // Measured through Godot 4.6.3: a Skeleton2D holding a
      // SkeletonModificationStack2D packs and saves as
      // `modification_stack = SubResource("SkeletonModificationStack2D_mwfi1")`,
      // hash-suffixed id and all. A bare one writes the key not at all, which
      // is why the fixture has to carry a stack.
      expect(check('modification_stack', 'SubResource("SkeletonModificationStack2D_mwfi1")')).toBeNull();
    });

    it('accepts an ExtResource form for a stack living in a .tres', () => {
      expect(check('modification_stack', 'ExtResource("1_stack")')).toBeNull();
    });

    it('rejects a value that is not a resource reference at all', () => {
      const error = check('modification_stack', '"res://stack.tres"');
      expect(error).not.toBeNull();
      expect(error!.severity).toBe('error');
      expect(error!.message).toContain('modification_stack');
    });

    it('rejects a reference whose id is unquoted', () => {
      expect(check('modification_stack', 'SubResource(1)')).not.toBeNull();
    });

    it('checks format only, because set_modification_stack assigns straight through', () => {
      // skeleton_2d.cpp:748-763 releases the previous stack, assigns
      // `modification_stack = p_stack`, and sets the new one up. No ERR_FAIL,
      // no clamp, no null guard — so under ADR-0032 there is no bound to
      // ground and nothing beyond the serialised shape to reject.
      const validator = validatorRegistry.declarationFor('Skeleton2D', 'modification_stack');
      expect(validator!.formatOnly).toBe(true);
      expect(validator!.grounding).toBeUndefined();
    });

    it('leaves the PROPERTY_HINT_RESOURCE_TYPE narrowing to a rule, not to itself', () => {
      // skeleton_2d.cpp:533-534 hints "SkeletonModificationStack2D", but a
      // reference names an id, not a type: resolving it needs the whole scene,
      // which a per-property validator never sees.
      expect(check('modification_stack', 'SubResource("SomeOtherResource_1")')).toBeNull();
    });
  });

  it('inherits its ancestors keys through the base-walk instead of re-declaring them', () => {
    // Skeleton2D < Node2D < CanvasItem < Node. A key redeclared here would
    // shadow the ancestor's validator and duplicate its rule.
    for (const inherited of ['position', 'scale', 'visible', 'z_index']) {
      expect(validatorRegistry.findValidator('Skeleton2D', inherited)).not.toBeNull();
      expect(validatorRegistry.getOwnKeys('Skeleton2D')).not.toContain(inherited);
    }
  });
});
