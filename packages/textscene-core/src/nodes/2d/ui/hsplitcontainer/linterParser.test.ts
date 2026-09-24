/**
 * HSplitContainer takes back one inherited key, `vertical`, which Godot's setter
 * refuses on this class; the base-walk can only widen a leaf. These tests pin
 * the removal and the inherited set it leaves.
 */

import { describe, expect, it } from 'vitest';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import './linterParser.js';

describe('HSplitContainer strict validators', () => {
  it('rejects `vertical`, which this class fixes', () => {
    const validator = validatorRegistry.findValidator('HSplitContainer', 'vertical');
    expect(validator).not.toBeNull();
    // Both literals fail: the property cannot be written at all, so there is no
    // "correct" value to accept.
    expect(validator!('vertical', 'true', 1)).not.toBeNull();
    expect(validator!('vertical', 'false', 1)).not.toBeNull();
    expect(validator!('vertical', 'true', 1)!.message).toContain('HSplitContainer');
  });

  it('still accepts `vertical` on the plain SplitContainer', () => {
    // The narrowing must be leaf-local: the base itself really does take it.
    const base = validatorRegistry.findValidator('SplitContainer', 'vertical');
    expect(base!('vertical', 'true', 1)).toBeNull();
  });

  it('inherits SplitContainer\'s own keys through the base-walk', () => {
    expect(validatorRegistry.findValidator('HSplitContainer', 'collapsed')).not.toBeNull();
  });

  it('inherits the Control layout set through the base-walk', () => {
    expect(validatorRegistry.findValidator('HSplitContainer', 'anchor_right')).not.toBeNull();
  });
});
