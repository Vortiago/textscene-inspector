/**
 * VScrollBar declares no validators of its own: doc/classes/VScrollBar.xml
 * lists only size_flags_horizontal/size_flags_vertical, both overrides="Control"
 * default changes. Assert the base-walk still resolves ScrollBar's, Range's,
 * Control's and CanvasItem's keys through it.
 */

import { describe, expect, it } from 'vitest';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import './linterParser.js';

describe('VScrollBar strict validators', () => {
  it('declares nothing of its own', () => {
    expect(validatorRegistry.getOwnKeys('VScrollBar')).toEqual([]);
  });

  it('reaches ScrollBar, Range, Control and CanvasItem keys through the base-walk', () => {
    expect(validatorRegistry.findValidator('VScrollBar', 'custom_step')).not.toBeNull();
    expect(validatorRegistry.findValidator('VScrollBar', 'min_value')).not.toBeNull();
    expect(validatorRegistry.findValidator('VScrollBar', 'anchor_right')).not.toBeNull();
    expect(validatorRegistry.findValidator('VScrollBar', 'modulate')).not.toBeNull();
  });

  it('carries no removal either: nothing in scroll_bar.cpp refuses a write on VScrollBar', () => {
    expect(validatorRegistry.getUnavailableKeys('VScrollBar')).toEqual([]);
  });
});
