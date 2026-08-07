/**
 * OpenXRRenderModel strict validators: declares none of its own.
 *
 * Its one member, `render_model`, is a `Variant::RID` — a runtime handle into
 * a live, per-process `RID_Owner` table (see linterParser.ts for the full
 * chain of reasoning, including why the grammar alone does not rule it out).
 * There is no `v.rid` in the validator DSL for the same reason: nothing in
 * this codebase treats an RID as a value a `.tscn` legitimately carries.
 *
 * An honest emptiness assertion, plus proof the base-walk still delivers
 * Node3D through it, exactly as HSeparator does for its zero own members.
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
    // The fixture's "zero errors and zero warnings" claim, RUN rather than
    // reasoned. `fixtureLint` owns the whole-registry version but needs the
    // barrel, so it cannot run while sibling slices are being written; this
    // checks the same file against whatever this test imported.
    expectFixtureClean('unit-open-xr-render-model.tscn');
  });

  it('reaches a Node3D key (transform) through the base-walk', () => {
    expect(validatorRegistry.findValidator('OpenXRRenderModel', 'transform')).not.toBeNull();
  });

  it('does not re-declare that inherited key as its own', () => {
    expect(validatorRegistry.getOwnKeys('OpenXRRenderModel')).not.toContain('transform');
  });
});
