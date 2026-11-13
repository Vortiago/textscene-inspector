import { afterEach, describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useDocumentVisibility } from './useDocumentVisibility';

/** Sets `document.visibilityState` and fires `visibilitychange`, as a browser does when a tab hides. */
function setDocumentVisibility(state: 'visible' | 'hidden'): void {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state });
  document.dispatchEvent(new Event('visibilitychange'));
}

afterEach(() => setDocumentVisibility('visible'));

describe('useDocumentVisibility', () => {
  it('is visible while the page shows', () => {
    const { result } = renderHook(() => useDocumentVisibility());

    expect(result.current).toBe(true);
  });

  it('turns false when the page hides, and true when it shows again', () => {
    const { result } = renderHook(() => useDocumentVisibility());

    act(() => setDocumentVisibility('hidden'));
    expect(result.current).toBe(false);
    act(() => setDocumentVisibility('visible'));
    expect(result.current).toBe(true);
  });

  it('is false from the start for a page opened in a background tab (edge case)', () => {
    setDocumentVisibility('hidden');

    const { result } = renderHook(() => useDocumentVisibility());

    expect(result.current).toBe(false);
  });
});
