/**
 * The CodeHighlighter slice's routing claims (ADR-0031). Importing the index
 * registers them; these assertions are what a router reads back out.
 */

import { describe, expect, it } from 'vitest';
import { registerResourceSlice, resourceSliceRegistry } from '../../sliceRegistration';
import { isBinaryResourceType } from '../../resourceProviderUtils';
import './index';

describe('codehighlighter slice registration', () => {
  it('claims CodeHighlighter for the shared resource bus slot', () => {
    const registration = resourceSliceRegistry.byTypeName('CodeHighlighter');
    expect(registration?.slice).toBe('codehighlighter');
    expect(registration?.kind).toBe('godot-text');
    expect(resourceSliceRegistry.busTypeFor('CodeHighlighter')).toBe('resource');
    expect(registration?.failureLabel).toBe('Resource');
  });

  it('claims no extension and is never fetched as bytes', () => {
    expect(resourceSliceRegistry.byTypeName('CodeHighlighter')?.extensions).toBeUndefined();
    expect(isBinaryResourceType('CodeHighlighter')).toBe(false);
    expect(isBinaryResourceType('CodeHighlighter', 'res://ui/highlighter.tres')).toBe(false);
  });

  it('rejects a second slice claiming CodeHighlighter', () => {
    expect(() =>
      registerResourceSlice({
        slice: 'not-codehighlighter',
        kind: 'godot-text',
        typeNames: ['CodeHighlighter'],
        busType: null,
        failureLabel: 'Impostor',
      })
    ).toThrow(/already claimed by slice "codehighlighter"/);
  });
});
