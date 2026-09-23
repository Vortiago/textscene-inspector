/**
 * Tests that OpenXRInteractionProfileEditor declares no properties (linterParser.ts) and that the base-walk
 * still carries the inherited set: Control and CanvasItem keys resolve, and HBoxContainer's removal of
 * `vertical` reaches it two hops up, past the abstract OpenXRInteractionProfileEditorBase.
 */

import { describe, expect, it } from 'vitest';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import './linterParser.js';

describe('OpenXRInteractionProfileEditor strict validators', () => {
  it('registers no validators of its own', () => {
    expect(validatorRegistry.getOwnKeys('OpenXRInteractionProfileEditor')).toEqual([]);
  });

  it('inherits the Control layout set through the base-walk', () => {
    const validator = validatorRegistry.findValidator('OpenXRInteractionProfileEditor', 'anchor_right');
    expect(validator).not.toBeNull();
    expect(validator!('anchor_right', '1.0', 1)).toBeNull();
  });

  it('inherits the CanvasItem set through the base-walk', () => {
    const validator = validatorRegistry.findValidator('OpenXRInteractionProfileEditor', 'modulate');
    expect(validator).not.toBeNull();
    expect(validator!('modulate', 'Color(1, 1, 0.7, 1)', 1)).toBeNull();
  });

  it('rejects `vertical`, removed two hops up on HBoxContainer', () => {
    const validator = validatorRegistry.findValidator('OpenXRInteractionProfileEditor', 'vertical');
    expect(validator).not.toBeNull();
    // Both literals fail: the property cannot be written, so no value is correct.
    expect(validator!('vertical', 'true', 1)).not.toBeNull();
    expect(validator!('vertical', 'false', 1)).not.toBeNull();
    expect(validator!('vertical', 'true', 1)!.message).toContain('OpenXRInteractionProfileEditor');
  });
});
