/**
 * HBoxContainer takes back one inherited key, `vertical`, which Godot's setter
 * refuses on this class; the base-walk can only widen a leaf. These tests pin
 * the removal and the inherited set it leaves.
 */

import { describe, expect, it } from 'vitest';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { lint, node, scene } from '../../../../linter/testing/testkit.js';
import './linterParser.js';

describe('HBoxContainer strict validators', () => {
  it('rejects `vertical`, which this class fixes', () => {
    const validator = validatorRegistry.findValidator('HBoxContainer', 'vertical');
    expect(validator).not.toBeNull();
    // Both literals fail: the property cannot be written at all, so there is no
    // "correct" value to accept.
    expect(validator!('vertical', 'true', 1)).not.toBeNull();
    expect(validator!('vertical', 'false', 1)).not.toBeNull();
    expect(validator!('vertical', 'true', 1)!.message).toContain('HBoxContainer');
  });

  it('still accepts `vertical` on the plain BoxContainer', () => {
    // The narrowing must be leaf-local: the base itself really does take it.
    const base = validatorRegistry.findValidator('BoxContainer', 'vertical');
    expect(base!('vertical', 'true', 1)).toBeNull();
  });

  it('inherits BoxContainer\'s own keys through the base-walk', () => {
    expect(validatorRegistry.findValidator('HBoxContainer', 'alignment')).not.toBeNull();
  });

  it('inherits the Control layout set through the base-walk', () => {
    expect(validatorRegistry.findValidator('HBoxContainer', 'anchor_right')).not.toBeNull();
  });
});

describe('a removed key set to null', () => {
  // The strict parser rewrites a validator error into the "null stores the
  // type's zero value" message. That claim is about a slot this class does not
  // have: set_vertical is ERR_FAIL_COND_MSG(is_fixed), so nothing is stored.
  // It also buries the removal's own reason.
  it('reports the removal, not the nil-literal rewrite', () => {
    const messages = lint(
      scene(node('HBoxContainer', { vertical: 'null' }, { name: 'Box' }))
    ).map((d) => d.message);
    expect(messages.join('\n')).toContain('cannot be set on HBoxContainer');
    expect(messages.join('\n')).not.toContain("stores the type's zero value");
  });
});
