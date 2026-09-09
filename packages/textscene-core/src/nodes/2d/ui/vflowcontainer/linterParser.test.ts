/**
 * VFlowContainer narrows exactly one inherited key and declares none of its own.
 *
 * The base-walk can only ever widen what a leaf accepts, so a fixed-orientation
 * container needs its own removal to take `vertical` back: Godot's setter
 * refuses it outright on this class. These assertions pin both halves: the
 * narrowing, and that narrowing did not cost the inherited set.
 */

import { describe, expect, it } from 'vitest';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import './linterParser.js';

describe('VFlowContainer strict validators', () => {
  it('declares no validators of its own', () => {
    expect(validatorRegistry.getOwnKeys('VFlowContainer')).toEqual([]);
  });

  it('rejects `vertical`, which this class fixes', () => {
    const validator = validatorRegistry.findValidator('VFlowContainer', 'vertical');
    expect(validator).not.toBeNull();
    // Both literals fail: the property cannot be written at all, so there is no
    // "correct" value to accept.
    expect(validator!('vertical', 'true', 1)).not.toBeNull();
    expect(validator!('vertical', 'false', 1)).not.toBeNull();
    expect(validator!('vertical', 'true', 1)!.message).toContain('VFlowContainer');
  });

  it('names `vertical` as its own removal, with a citation', () => {
    const removals = validatorRegistry.getOwnRemovals('VFlowContainer');
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
    expect(validatorRegistry.findValidator('VFlowContainer', 'alignment')).not.toBeNull();
  });

  it('inherits the Control layout set through the base-walk', () => {
    expect(validatorRegistry.findValidator('VFlowContainer', 'anchor_right')).not.toBeNull();
  });

  it('inherits the CanvasItem set through the base-walk', () => {
    expect(validatorRegistry.findValidator('VFlowContainer', 'modulate')).not.toBeNull();
  });
});
