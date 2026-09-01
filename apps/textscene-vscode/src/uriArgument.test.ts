/**
 * The narrowing exists to keep the panel map's key injective. Its cases are
 * therefore about what stringifies alike, not about what looks Uri-shaped.
 */

import { describe, it, expect } from 'vitest';
import { isUri } from './uriArgument';
import { createMockUri } from './vscodeMocks.testkit';

describe('isUri', () => {
  it('accepts the Uri shape the API and the mocks both carry', () => {
    expect(isUri(createMockUri('/scenes/main.tscn'))).toBe(true);
  });

  it('rejects a bare fsPath object, which keys the panel map as [object Object]', () => {
    // Two distinct scenes, one map entry: the second preview would reveal the
    // first's panel. `String()` is what `Map` sees through `toString()`.
    const first = { fsPath: '/scenes/a.tscn' };
    const second = { fsPath: '/scenes/b.tscn' };
    expect(String(first)).toBe(String(second));
    expect(isUri(first)).toBe(false);
    expect(isUri(second)).toBe(false);
  });

  it('rejects what the palette entry passes, so the active editor answers', () => {
    expect(isUri(undefined)).toBe(false);
    expect(isUri(null)).toBe(false);
  });

  it('rejects a non-object and an object with a non-string fsPath', () => {
    expect(isUri('res://scenes/main.tscn')).toBe(false);
    expect(isUri({ fsPath: 42, scheme: 'file' })).toBe(false);
  });
});
