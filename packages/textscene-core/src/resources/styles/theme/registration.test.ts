/**
 * The Theme slice's routing claims (ADR-0031). Importing the index registers
 * them; these assertions are what a router reads back out.
 */

import { describe, expect, it } from 'vitest';
import { registerResourceSlice, resourceSliceRegistry } from '../../sliceRegistration';
import { isBinaryResourceType } from '../../resourceProviderUtils';
import './index';

describe('theme slice registration', () => {
  it('claims Theme for the theme bus slot', () => {
    const registration = resourceSliceRegistry.byTypeName('Theme');
    expect(registration?.slice).toBe('theme');
    expect(registration?.kind).toBe('godot-text');
    expect(resourceSliceRegistry.busTypeFor('Theme')).toBe('theme');
    expect(registration?.failureLabel).toBe('Node using theme');
  });

  it('claims no extension and is never fetched as bytes', () => {
    // A Theme is always `.tres` — the shared Godot-text container no slice may
    // claim — so routing is by type name and the provider fetches text.
    expect(resourceSliceRegistry.byTypeName('Theme')?.extensions).toBeUndefined();
    expect(isBinaryResourceType('Theme')).toBe(false);
    expect(isBinaryResourceType('Theme', 'res://ui/main_theme.tres')).toBe(false);
  });

  it('rejects a second slice claiming Theme', () => {
    expect(() =>
      registerResourceSlice({
        slice: 'not-theme',
        kind: 'godot-text',
        typeNames: ['Theme'],
        busType: null,
        failureLabel: 'Impostor',
      })
    ).toThrow(/already claimed by slice "theme"/);
  });
});
