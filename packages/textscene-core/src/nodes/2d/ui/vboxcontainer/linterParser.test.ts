/**
 * VBoxContainer narrows one inherited key and inherits the rest. The base-walk only widens, so
 * a fixed-orientation container needs its own validator to take `vertical` back, which Godot's
 * setter refuses on this class. These tests pin the narrowing and the inherited set.
 */

import { describe, expect, it } from 'vitest';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import './linterParser.js';

describe('VBoxContainer strict validators', () => {
  it('rejects `vertical`, which this class fixes', () => {
    const validator = validatorRegistry.findValidator('VBoxContainer', 'vertical');
    expect(validator).not.toBeNull();
    // Both literals fail: the property cannot be written at all, so there is no
    // "correct" value to accept.
    expect(validator!('vertical', 'true', 1)).not.toBeNull();
    expect(validator!('vertical', 'false', 1)).not.toBeNull();
    expect(validator!('vertical', 'true', 1)!.message).toContain('VBoxContainer');
  });

  it('still accepts `vertical` on the plain BoxContainer', () => {
    // The narrowing must be leaf-local: the base itself really does take it.
    const base = validatorRegistry.findValidator('BoxContainer', 'vertical');
    expect(base!('vertical', 'true', 1)).toBeNull();
  });

  it('inherits BoxContainer\'s own keys through the base-walk', () => {
    expect(validatorRegistry.findValidator('VBoxContainer', 'alignment')).not.toBeNull();
  });

  it('inherits the Control layout set through the base-walk', () => {
    expect(validatorRegistry.findValidator('VBoxContainer', 'anchor_right')).not.toBeNull();
  });
});
