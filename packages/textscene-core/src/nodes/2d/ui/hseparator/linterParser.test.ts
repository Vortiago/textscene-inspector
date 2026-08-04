/**
 * HSeparator strict validators: declares none of its own.
 *
 * doc/classes/HSeparator.xml lists zero <members>, and its constructor
 * (separator.cpp:71-73) only sets the protected `orientation` field, which is
 * not a property (see linterParser.ts). The scaffold's original sweep,
 * `getOwnKeys('HSeparator').filter(...)` over an empty key set, would pass
 * vacuously on nothing, so it is replaced with an honest emptiness assertion
 * plus proof the base-walk still delivers Control, CanvasItem, and the
 * theme-override wildcard through Separator.
 */

import { describe, expect, it } from 'vitest';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry';
import './linterParser';

describe('HSeparator strict validators', () => {
  it('declares no validators of its own', () => {
    expect(validatorRegistry.getOwnKeys('HSeparator')).toEqual([]);
  });

  it('reaches a Control key through the base-walk', () => {
    expect(validatorRegistry.findValidator('HSeparator', 'anchor_right')).not.toBeNull();
  });

  it('reaches a CanvasItem key through the base-walk', () => {
    expect(validatorRegistry.findValidator('HSeparator', 'modulate')).not.toBeNull();
  });

  it('reaches the theme_override_constants wildcard (a theme item, not Separator state)', () => {
    expect(
      validatorRegistry.findValidator('HSeparator', 'theme_override_constants/separation')
    ).not.toBeNull();
  });
});
