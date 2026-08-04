/**
 * HScrollBar declares no validators of its own: doc/classes/HScrollBar.xml
 * has no <members>. Assert the base-walk still resolves ScrollBar's,
 * Range's, Control's and CanvasItem's keys through it.
 */

import { describe, expect, it } from 'vitest';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import './linterParser.js';

describe('HScrollBar strict validators', () => {
  it('declares nothing of its own', () => {
    expect(validatorRegistry.getOwnKeys('HScrollBar')).toEqual([]);
  });

  it('reaches ScrollBar, Range, Control and CanvasItem keys through the base-walk', () => {
    expect(validatorRegistry.findValidator('HScrollBar', 'custom_step')).not.toBeNull();
    expect(validatorRegistry.findValidator('HScrollBar', 'min_value')).not.toBeNull();
    expect(validatorRegistry.findValidator('HScrollBar', 'anchor_right')).not.toBeNull();
    expect(validatorRegistry.findValidator('HScrollBar', 'modulate')).not.toBeNull();
  });

  it('carries no removal either: nothing in scroll_bar.cpp refuses a write on HScrollBar', () => {
    expect(validatorRegistry.getUnavailableKeys('HScrollBar')).toEqual([]);
  });
});
