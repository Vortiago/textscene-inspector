/**
 * `useSceneSource`'s `onBeforeSwap`, the single moment resource resolution may be re-pointed.
 * The hook keeps the hold-last-valid invariant (ADR-0020). The shared scaffolding is in
 * `useSceneSource.testkit.ts`.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';

// A stub resolveForwardedContent passes valid TSCN and rejects garbage. `vi.mock` is hoisted
// per module graph, so every suite in this split declares its own.
vi.mock('./sourceGate', () => ({
  resolveForwardedContent: (buffer: string, lastGood: string) =>
    buffer.trim().startsWith('[gd_scene') ? buffer : lastGood,
}));

import { useSceneSource } from './useSceneSource';
import {
  FIXTURE_TSCN,
  VALID_EDIT_TSCN,
  deferred,
  mockFetchOk,
  mockFetchFail,
  settle,
} from './useSceneSource.testkit';

beforeEach(() => {
  try {
    globalThis.localStorage.clear();
  } catch {
    // Clearing storage is optional.
  }
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('onBeforeSwap — the only moment resource resolution may be re-pointed', () => {
  it('fires with the arriving fixture BEFORE its content becomes the render', async () => {
    const text = deferred<string>();
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: () => text.promise,
    } as unknown as Response) as unknown as typeof fetch;

    // Records what the hook had rendered when the callback ran: the swap is announced while
    // the outgoing content is still in place.
    const calls: { file: string; forwardedAtCall: string }[] = [];
    const { result } = renderHook(() =>
      useSceneSource({
        fixtureFile: 'unit-plane-mesh.tscn',
        uploadedTscnName: null,
        onBeforeSwap: (file) =>
          calls.push({ file, forwardedAtCall: result.current.forwardedContent }),
      })
    );

    await waitFor(() => {
      expect(result.current.isFetching).toBe(true);
    });
    expect(calls).toHaveLength(0);

    await act(async () => {
      text.resolve(FIXTURE_TSCN);
    });

    expect(calls).toEqual([{ file: 'unit-plane-mesh.tscn', forwardedAtCall: '' }]);
    expect(result.current.forwardedContent).toBe(FIXTURE_TSCN);
  });

  it('does NOT fire for an edit, a fetch failure, or a load the user has superseded', async () => {
    const onBeforeSwap = vi.fn();

    // Fetch failure.
    globalThis.fetch = mockFetchFail();
    const failed = renderHook(() =>
      useSceneSource({
        fixtureFile: 'unit-plane-mesh.tscn',
        uploadedTscnName: null,
        onBeforeSwap,
      })
    );
    await waitFor(() => {
      expect(failed.result.current.loadError).toBeTruthy();
    });
    expect(onBeforeSwap).not.toHaveBeenCalled();
    failed.unmount();

    // A load the user superseded by typing is dropped, and must not re-point resolution.
    const text = deferred<string>();
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: () => text.promise,
    } as unknown as Response) as unknown as typeof fetch;
    const edited = renderHook(() =>
      useSceneSource({
        fixtureFile: 'unit-plane-mesh.tscn',
        uploadedTscnName: null,
        onBeforeSwap,
      })
    );
    act(() => {
      edited.result.current.onBufferChange(VALID_EDIT_TSCN);
    });
    await act(async () => {
      text.resolve(FIXTURE_TSCN);
    });
    expect(onBeforeSwap).not.toHaveBeenCalled();

    // And a plain debounced edit forward is not a swap.
    await settle(500);
    expect(onBeforeSwap).not.toHaveBeenCalled();
  });

  it('an unstable callback never re-triggers the fetch — it is read from a ref', async () => {
    globalThis.fetch = mockFetchOk(FIXTURE_TSCN);

    const { result, rerender } = renderHook(() =>
      // A fresh identity every render, which would refetch each time if it reached the deps.
      useSceneSource({
        fixtureFile: 'unit-plane-mesh.tscn',
        uploadedTscnName: null,
        onBeforeSwap: () => {},
      })
    );

    await waitFor(() => {
      expect(result.current.buffer).toBe(FIXTURE_TSCN);
    });
    const callsAfterLoad = (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls
      .length;

    rerender();
    rerender();

    expect(
      (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.length
    ).toBe(callsAfterLoad);
  });
});
