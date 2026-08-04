/**
 * OpenXRBindingModifierEditor strict validators: coverage check.
 *
 * The type declares no ADD_PROPERTY of its own (see linterParser.ts), so
 * there is no per-property happy/malformed/edge case to grow here. What
 * matters is that the base-walk still reaches every inherited key a scene
 * author can legally set on it, including `size_flags_horizontal`, the one
 * member modules/openxr/doc_classes/OpenXRBindingModifierEditor.xml lists
 * for this type, tagged overrides="Control" because the constructor only
 * changes its default (openxr_binding_modifier_editor.cpp:249).
 */

import { describe, expect, it } from 'vitest';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry';
import './linterParser';

describe('OpenXRBindingModifierEditor strict validators', () => {
  it('declares no validators of its own', () => {
    expect(validatorRegistry.getOwnKeys('OpenXRBindingModifierEditor')).toEqual([]);
  });

  it('resolves inherited Control/CanvasItem keys through the base-walk', () => {
    expect(
      validatorRegistry.findValidator('OpenXRBindingModifierEditor', 'anchor_right')
    ).not.toBeNull();
    expect(
      validatorRegistry.findValidator('OpenXRBindingModifierEditor', 'modulate')
    ).not.toBeNull();
    expect(
      validatorRegistry.findValidator('OpenXRBindingModifierEditor', 'size_flags_horizontal')
    ).not.toBeNull();
  });

  it('rejects a malformed value on an inherited validator', () => {
    const validator = validatorRegistry.findValidator('OpenXRBindingModifierEditor', 'anchor_right');
    expect(validator).not.toBeNull();
    expect(validator!('anchor_right', 'not-a-float', 1)).not.toBeNull();
  });
});
