/**
 * `useSceneSource` — `onBeforeSwap`: the single moment resource resolution may be re-pointed.
 *
 * The hook owns the hold-last-valid edit-loop invariant (ADR-0020): a resolving
 * fixture load must never stomp newer keystrokes. Shared scaffolding is in
 * `useSceneSource.testkit.ts`.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';

// Stub resolveForwardedContent: valid TSCN passes through, garbage is rejected.
// Hoisted per module graph, so every suite in this split declares its own.
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
    // ignore
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

    // Records what the hook had rendered at the instant the callback ran — the
    // swap must be announced while the OUTGOING content is still in place.
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

    // A load the user superseded by typing — the resolution is dropped, and a
    // dropped resolution must not re-point resolution either.
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
      // A fresh identity every render — if it landed in the effect's deps this
      // would refetch on each one.
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
