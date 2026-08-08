/**
 * `useSceneSource` — the fixture fetch: what a resolution sets, what a rejection holds, and the no-fixture start.
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
  deferred,
  mockFetchOk,
  mockFetchFail,
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

// ---------------------------------------------------------------------------
// Fixture load: happy path
// ---------------------------------------------------------------------------

describe('fixture load — happy path', () => {
  it('sets buffer and forwardedContent to fetched text on successful load', async () => {
    globalThis.fetch = mockFetchOk(FIXTURE_TSCN);

    const { result } = renderHook(() =>
      useSceneSource({ fixtureFile: 'unit-plane-mesh.tscn', uploadedTscnName: null })
    );

    await waitFor(() => {
      expect(result.current.buffer).toBe(FIXTURE_TSCN);
    });
    expect(result.current.forwardedContent).toBe(FIXTURE_TSCN);
    expect(result.current.isFetching).toBe(false);
    expect(result.current.loadError).toBeNull();
  });

  it('sets isFetching true while fetch is in flight, false once resolved', async () => {
    const text = deferred<string>();
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: () => text.promise,
    } as unknown as Response) as unknown as typeof fetch;

    const { result } = renderHook(() =>
      useSceneSource({ fixtureFile: 'unit-plane-mesh.tscn', uploadedTscnName: null })
    );

    await waitFor(() => {
      expect(result.current.isFetching).toBe(true);
    });

    await act(async () => {
      text.resolve(FIXTURE_TSCN);
    });

    await waitFor(() => {
      expect(result.current.isFetching).toBe(false);
    });
    expect(result.current.buffer).toBe(FIXTURE_TSCN);
  });

  it('stores the fixture key in localStorage on successful load', async () => {
    globalThis.fetch = mockFetchOk(FIXTURE_TSCN);

    renderHook(() =>
      useSceneSource({ fixtureFile: 'unit-plane-mesh.tscn', uploadedTscnName: null })
    );

    await waitFor(() => {
      expect(globalThis.localStorage.getItem('tscn-web-r3f-fixture')).toBe(
        'unit-plane-mesh.tscn'
      );
    });
  });
});

// ---------------------------------------------------------------------------
// Fetch failure: buffer cleared, forwardedContent held (last valid render)
// ---------------------------------------------------------------------------

describe('fixture load — fetch failure', () => {
  it('clears the buffer, sets loadError, and holds forwardedContent on fetch failure', async () => {
    // First load succeeds to establish a valid forwardedContent baseline.
    globalThis.fetch = mockFetchOk(FIXTURE_TSCN);
    const { result, rerender } = renderHook(
      ({ fixtureFile }: { fixtureFile: string }) =>
        useSceneSource({ fixtureFile, uploadedTscnName: null }),
      { initialProps: { fixtureFile: 'unit-plane-mesh.tscn' } }
    );

    await waitFor(() => {
      expect(result.current.forwardedContent).toBe(FIXTURE_TSCN);
    });

    // Switch to a fixture whose fetch fails.
    globalThis.fetch = mockFetchFail();
    rerender({ fixtureFile: 'other-fixture.tscn' });

    await waitFor(() => {
      expect(result.current.loadError).toContain('Failed to load fixture');
    });

    // Buffer cleared on failure…
    expect(result.current.buffer).toBe('');
    // …but forwardedContent held to preserve the last valid render.
    expect(result.current.forwardedContent).toBe(FIXTURE_TSCN);
    expect(result.current.isFetching).toBe(false);
  });

  it('hides isFetching once the fetch fails', async () => {
    globalThis.fetch = mockFetchFail();

    const { result } = renderHook(() =>
      useSceneSource({ fixtureFile: 'unit-plane-mesh.tscn', uploadedTscnName: null })
    );

    await waitFor(() => {
      expect(result.current.loadError).toBeTruthy();
    });
    expect(result.current.isFetching).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// No fixture + no upload: empty state
// ---------------------------------------------------------------------------

describe('empty state — no fixtureFile and no uploadedTscnName', () => {
  it('starts with empty buffer and forwardedContent when fixtureFile is empty', () => {
    const { result } = renderHook(() =>
      useSceneSource({ fixtureFile: '', uploadedTscnName: null })
    );

    expect(result.current.buffer).toBe('');
    expect(result.current.forwardedContent).toBe('');
    expect(result.current.isFetching).toBe(false);
    expect(result.current.loadError).toBeNull();
  });
});
