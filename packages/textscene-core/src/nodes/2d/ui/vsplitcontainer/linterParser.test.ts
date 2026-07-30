/**
 * VSplitContainer narrows exactly one inherited key and inherits the rest.
 *
 * The base-walk can only ever widen what a leaf accepts, so a fixed-orientation
 * container needs its own validator to take `vertical` back — Godot's setter
 * refuses it outright on this class. These assertions pin both halves: the
 * narrowing, and that narrowing did not cost the inherited set.
 */

import { describe, expect, it } from 'vitest';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import './linterParser.js';

describe('VSplitContainer strict validators', () => {
  it('rejects `vertical`, which this class fixes', () => {
    const validator = validatorRegistry.findValidator('VSplitContainer', 'vertical');
    expect(validator).not.toBeNull();
    // Both literals fail: the property cannot be written at all, so there is no
    // "correct" value to accept.
    expect(validator!('vertical', 'true', 1)).not.toBeNull();
    expect(validator!('vertical', 'false', 1)).not.toBeNull();
    expect(validator!('vertical', 'true', 1)!.message).toContain('VSplitContainer');
  });

  it('still accepts `vertical` on the plain SplitContainer', () => {
    // The narrowing must be leaf-local: the base itself really does take it.
    const base = validatorRegistry.findValidator('SplitContainer', 'vertical');
    expect(base!('vertical', 'true', 1)).toBeNull();
  });

  it('inherits SplitContainer\'s own keys through the base-walk', () => {
    expect(validatorRegistry.findValidator('VSplitContainer', 'collapsed')).not.toBeNull();
  });

  it('inherits the Control layout set through the base-walk', () => {
    expect(validatorRegistry.findValidator('VSplitContainer', 'anchor_right')).not.toBeNull();
  });
});
