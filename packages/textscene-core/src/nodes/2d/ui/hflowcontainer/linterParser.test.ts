/**
 * HFlowContainer narrows exactly one inherited key and declares none of its own.
 *
 * The base-walk can only ever widen what a leaf accepts, so a fixed-orientation
 * container needs its own removal to take `vertical` back - Godot's setter
 * refuses it outright on this class. These assertions pin the removal and its
 * citation, that the type declares no member of its own, and that the removal
 * did not cost the inherited set.
 */

import { describe, expect, it } from 'vitest';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import './linterParser.js';

describe('HFlowContainer strict validators', () => {
  it('declares no member of its own', () => {
    expect(validatorRegistry.getOwnKeys('HFlowContainer')).toEqual([]);
  });

  it('rejects `vertical`, which this class fixes', () => {
    const validator = validatorRegistry.findValidator('HFlowContainer', 'vertical');
    expect(validator).not.toBeNull();
    // Both literals fail: the property cannot be written at all, so there is no
    // "correct" value to accept.
    expect(validator!('vertical', 'true', 1)).not.toBeNull();
    expect(validator!('vertical', 'false', 1)).not.toBeNull();
    expect(validator!('vertical', 'true', 1)!.message).toContain('HFlowContainer');
  });

  it('names the removal with its citation', () => {
    const removals = validatorRegistry.getOwnRemovals('HFlowContainer');
    expect(Object.keys(removals)).toEqual(['vertical']);
    expect(removals['vertical']?.cite).toBe('flow_container.cpp:372');
    expect(removals['vertical']?.reason.length).toBeGreaterThan(0);
  });

  it('still accepts `vertical` on the plain FlowContainer', () => {
    // The narrowing must be leaf-local: the base itself really does take it.
    const base = validatorRegistry.findValidator('FlowContainer', 'vertical');
    expect(base!('vertical', 'true', 1)).toBeNull();
  });

  it("inherits FlowContainer's own keys through the base-walk", () => {
    expect(validatorRegistry.findValidator('HFlowContainer', 'alignment')).not.toBeNull();
  });

  it('inherits the Control layout set through the base-walk', () => {
    expect(validatorRegistry.findValidator('HFlowContainer', 'anchor_right')).not.toBeNull();
  });

  it('inherits the CanvasItem set through the base-walk', () => {
    expect(validatorRegistry.findValidator('HFlowContainer', 'modulate')).not.toBeNull();
  });
});
