/**
 * HSeparator declares no validator: doc/classes/HSeparator.xml has no members, and its
 * constructor (separator.cpp:71-73) only sets the protected `orientation`. A malformed-value
 * check over an empty key set passes vacuously, so these tests assert the emptiness and that
 * the base-walk delivers Control, CanvasItem and the theme-override wildcard.
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
