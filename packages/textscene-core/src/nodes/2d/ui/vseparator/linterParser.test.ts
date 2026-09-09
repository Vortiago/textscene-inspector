/**
 * VSeparator strict validators: declares none of its own.
 *
 * doc/classes/VSeparator.xml lists zero <members>, and its constructor
 * (separator.cpp:75-77) only sets the protected `orientation` field, which is
 * not a property (see linterParser.ts). The scaffold's original sweep,
 * `getOwnKeys('VSeparator').filter(...)` over an empty key set, would pass
 * vacuously on nothing, so it is replaced with an honest emptiness assertion
 * plus proof the base-walk still delivers Control, CanvasItem, and the
 * theme-override wildcard through Separator.
 */

import { describe, expect, it } from 'vitest';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry';
import './linterParser';

describe('VSeparator strict validators', () => {
  it('declares no validators of its own', () => {
    expect(validatorRegistry.getOwnKeys('VSeparator')).toEqual([]);
  });

  it('reaches a Control key through the base-walk', () => {
    expect(validatorRegistry.findValidator('VSeparator', 'anchor_right')).not.toBeNull();
  });

  it('reaches a CanvasItem key through the base-walk', () => {
    expect(validatorRegistry.findValidator('VSeparator', 'modulate')).not.toBeNull();
  });

  it('reaches the theme_override_constants wildcard (a theme item, not Separator state)', () => {
    expect(
      validatorRegistry.findValidator('VSeparator', 'theme_override_constants/separation')
    ).not.toBeNull();
  });
});
