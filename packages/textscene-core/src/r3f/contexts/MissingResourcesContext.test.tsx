/**
 * Contract tests for MissingResourcesContext: the per-shell aggregation of
 * missing / uploaded resource paths that MissingResourcesPanel consumes.
 * Aggregation through useResource is covered in
 * resources/useResource.missing-aggregation.test.tsx — here we pin the
 * context's own state machine (report/clear/markUploaded/removeUploaded).
 */
import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import {
  MissingResourcesProvider,
  useMissingResources,
} from './MissingResourcesContext';

function wrap({ children }: { children: ReactNode }) {
  return <MissingResourcesProvider>{children}</MissingResourcesProvider>;
}

describe('MissingResourcesContext', () => {
  it('starts with empty missing and uploaded sets', () => {
    const { result } = renderHook(() => useMissingResources(), { wrapper: wrap });
    expect(result.current.missingPaths.size).toBe(0);
    expect(result.current.uploadedPaths.size).toBe(0);
  });

  it('report adds a path to missingPaths', () => {
    const { result } = renderHook(() => useMissingResources(), { wrapper: wrap });
    act(() => result.current.report('res://a.png'));
    expect(result.current.missingPaths.has('res://a.png')).toBe(true);
    expect(result.current.missingPaths.size).toBe(1);
  });

  it('duplicate report is idempotent (same set instance, no state churn)', () => {
    const { result } = renderHook(() => useMissingResources(), { wrapper: wrap });
    act(() => result.current.report('res://a.png'));
    const setAfterFirst = result.current.missingPaths;
    act(() => result.current.report('res://a.png'));
    expect(result.current.missingPaths.size).toBe(1);
    // The reducer bails out on duplicates, so the Set identity is preserved —
    // consumers depending on `missingPaths` don't re-render.
    expect(result.current.missingPaths).toBe(setAfterFirst);
  });

  it('report ignores empty paths', () => {
    const { result } = renderHook(() => useMissingResources(), { wrapper: wrap });
    act(() => result.current.report(''));
    expect(result.current.missingPaths.size).toBe(0);
  });

  it('clear removes a reported path and is a no-op for unknown paths', () => {
    const { result } = renderHook(() => useMissingResources(), { wrapper: wrap });
    act(() => {
      result.current.report('res://a.png');
      result.current.report('res://b.png');
    });
    act(() => result.current.clear('res://a.png'));
    expect(result.current.missingPaths.has('res://a.png')).toBe(false);
    expect(result.current.missingPaths.has('res://b.png')).toBe(true);

    const before = result.current.missingPaths;
    act(() => result.current.clear('res://never-reported.png'));
    expect(result.current.missingPaths).toBe(before);
  });

  it('markUploaded moves a path from missingPaths into uploadedPaths', () => {
    const { result } = renderHook(() => useMissingResources(), { wrapper: wrap });
    act(() => result.current.report('res://tex.png'));
    act(() => result.current.markUploaded('res://tex.png'));
    expect(result.current.missingPaths.has('res://tex.png')).toBe(false);
    expect(result.current.uploadedPaths.has('res://tex.png')).toBe(true);
  });

  it('markUploaded works for a path never reported missing', () => {
    const { result } = renderHook(() => useMissingResources(), { wrapper: wrap });
    act(() => result.current.markUploaded('res://extra.glb'));
    expect(result.current.uploadedPaths.has('res://extra.glb')).toBe(true);
    expect(result.current.missingPaths.size).toBe(0);
  });

  it('removeUploaded removes a previously-uploaded path', () => {
    const { result } = renderHook(() => useMissingResources(), { wrapper: wrap });
    act(() => result.current.markUploaded('res://tex.png'));
    act(() => result.current.removeUploaded('res://tex.png'));
    expect(result.current.uploadedPaths.size).toBe(0);
  });

  it('state survives a provider re-render', () => {
    const { result, rerender } = renderHook(() => useMissingResources(), {
      wrapper: wrap,
    });
    act(() => {
      result.current.report('res://a.png');
      result.current.markUploaded('res://b.png');
    });
    rerender();
    expect(result.current.missingPaths.has('res://a.png')).toBe(true);
    expect(result.current.uploadedPaths.has('res://b.png')).toBe(true);
  });

  it('callback identities are stable across state changes (useResource effect contract)', () => {
    const { result } = renderHook(() => useMissingResources(), { wrapper: wrap });
    const { report, clear, markUploaded, removeUploaded } = result.current;
    act(() => result.current.report('res://a.png'));
    expect(result.current.report).toBe(report);
    expect(result.current.clear).toBe(clear);
    expect(result.current.markUploaded).toBe(markUploaded);
    expect(result.current.removeUploaded).toBe(removeUploaded);
  });

  it('outside a provider: returns empty sets and callable no-op actions', () => {
    const { result } = renderHook(() => useMissingResources());
    expect(result.current.missingPaths.size).toBe(0);
    expect(result.current.uploadedPaths.size).toBe(0);
    // Documented no-provider contract: consumers may call unconditionally.
    expect(() => {
      result.current.report('res://a.png');
      result.current.clear('res://a.png');
      result.current.markUploaded('res://a.png');
      result.current.removeUploaded('res://a.png');
    }).not.toThrow();
    expect(result.current.missingPaths.size).toBe(0);
  });
});
