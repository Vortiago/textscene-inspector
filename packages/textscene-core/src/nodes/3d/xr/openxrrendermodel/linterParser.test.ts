/**
 * OpenXRRenderModel declares no strict validators of its own: its one member, `render_model`, is a
 * runtime `Variant::RID` handle (linterParser.ts has the reasoning), and the DSL has no `v.rid`.
 * This asserts the emptiness, and that the base-walk still delivers Node3D.
 */

import { describe, expect, it } from 'vitest';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry';
import { expectFixtureClean } from '../../../../linter/testing/fixtureCheck';
import './linterParser';

describe('OpenXRRenderModel strict validators', () => {
  it('declares no validators of its own', () => {
    expect(validatorRegistry.getOwnKeys('OpenXRRenderModel')).toEqual([]);
  });

  it('accepts every value its own fixture carries', () => {
    // The fixture's "zero errors and zero warnings" claim, run, not reasoned. `fixtureLint`
    // checks it against the whole registry through the barrel. This checks the same file
    // against only what this test imported.
    expectFixtureClean('unit-open-xr-render-model.tscn');
  });

  it('reaches a Node3D key (transform) through the base-walk', () => {
    expect(validatorRegistry.findValidator('OpenXRRenderModel', 'transform')).not.toBeNull();
  });

  it('does not re-declare that inherited key as its own', () => {
    expect(validatorRegistry.getOwnKeys('OpenXRRenderModel')).not.toContain('transform');
  });
});
