/**
 * `useSceneSource` — the two authoritative content swaps — an upload, and a fixture switch.
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
  SECOND_TSCN,
  UPLOADED_TSCN,
  GARBAGE,
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

// ---------------------------------------------------------------------------
// Upload (replace): authoritative — supersedes pending debounce
// ---------------------------------------------------------------------------

describe('replace — upload supersedes pending debounce', () => {
  it('sets buffer and forwardedContent immediately, cancels any pending debounce', async () => {
    globalThis.fetch = mockFetchOk(FIXTURE_TSCN);

    const { result } = renderHook(() =>
      useSceneSource({ fixtureFile: 'unit-plane-mesh.tscn', uploadedTscnName: null })
    );

    await waitFor(() => {
      expect(result.current.buffer).toBe(FIXTURE_TSCN);
    });

    // Arm a debounce with garbage so the gate would reject it if it fired.
    act(() => {
      result.current.onBufferChange(GARBAGE);
    });

    // Upload arrives before the debounce fires — replace must win.
    act(() => {
      result.current.replace(UPLOADED_TSCN);
    });

    // Both buffer and forwardedContent immediately reflect the upload.
    expect(result.current.buffer).toBe(UPLOADED_TSCN);
    expect(result.current.forwardedContent).toBe(UPLOADED_TSCN);

    // Advance past the debounce window — the garbage timer must not fire.
    await settle(500);

    expect(result.current.buffer).toBe(UPLOADED_TSCN);
    expect(result.current.forwardedContent).toBe(UPLOADED_TSCN);
  });

  it('clears a stale fetch loadError — the pane now holds known content', async () => {
    globalThis.fetch = mockFetchFail();

    const { result } = renderHook(() =>
      useSceneSource({ fixtureFile: 'unit-plane-mesh.tscn', uploadedTscnName: null })
    );

    await waitFor(() => {
      expect(result.current.loadError).toBeTruthy();
    });

    act(() => {
      result.current.replace(UPLOADED_TSCN);
    });

    expect(result.current.loadError).toBeNull();
    expect(result.current.buffer).toBe(UPLOADED_TSCN);
    expect(result.current.forwardedContent).toBe(UPLOADED_TSCN);
  });

  it('resets isFetching when an upload supersedes an in-flight fixture fetch', async () => {
    // Hold the fixture fetch open, then switch to an upload before it resolves.
    const text = deferred<string>();
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: () => text.promise,
    } as unknown as Response) as unknown as typeof fetch;

    const { result, rerender } = renderHook(
      (props: { fixtureFile: string; uploadedTscnName: string | null }) => useSceneSource(props),
      { initialProps: { fixtureFile: 'unit-plane-mesh.tscn', uploadedTscnName: null } }
    );

    await waitFor(() => {
      expect(result.current.isFetching).toBe(true);
    });

    // Upload path: fixture cleared, upload name set, content replaced.
    act(() => {
      result.current.replace(UPLOADED_TSCN);
    });
    rerender({ fixtureFile: '', uploadedTscnName: 'uploaded.tscn' });

    // The cancelled fetch's finally() skips its reset — the effect's
    // empty-fixture branch must clear the flag instead.
    expect(result.current.isFetching).toBe(false);

    // The abandoned fetch resolving later must not stomp the upload.
    await act(async () => {
      text.resolve(FIXTURE_TSCN);
    });
    expect(result.current.buffer).toBe(UPLOADED_TSCN);
    expect(result.current.forwardedContent).toBe(UPLOADED_TSCN);
    expect(result.current.isFetching).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Fixture switch: fetches new content, replaces buffer
// ---------------------------------------------------------------------------

describe('fixture switch — loads new fixture content into buffer', () => {
  it('fetches the second fixture and replaces the buffer when fixtureFile changes', async () => {
    globalThis.fetch = mockFetchOk(FIXTURE_TSCN);

    const { result, rerender } = renderHook(
      ({ fixtureFile }: { fixtureFile: string }) =>
        useSceneSource({ fixtureFile, uploadedTscnName: null }),
      { initialProps: { fixtureFile: 'unit-plane-mesh.tscn' } }
    );

    await waitFor(() => {
      expect(result.current.buffer).toBe(FIXTURE_TSCN);
    });

    globalThis.fetch = mockFetchOk(SECOND_TSCN);
    rerender({ fixtureFile: 'unit-box-mesh.tscn' });

    await waitFor(() => {
      expect(result.current.buffer).toBe(SECOND_TSCN);
    });
    expect(result.current.forwardedContent).toBe(SECOND_TSCN);
  });

  it('resets editedSinceLoad on a fixture switch so a late prior fetch is cancelled', async () => {
    // First fixture's fetch is held open.
    const first = deferred<string>();
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: () => first.promise,
    } as unknown as Response) as unknown as typeof fetch;

    const { result, rerender } = renderHook(
      ({ fixtureFile }: { fixtureFile: string }) =>
        useSceneSource({ fixtureFile, uploadedTscnName: null }),
      { initialProps: { fixtureFile: 'unit-plane-mesh.tscn' } }
    );

    // Switch before the first fixture resolves. React cleanup cancels the first effect.
    globalThis.fetch = mockFetchOk(SECOND_TSCN);
    rerender({ fixtureFile: 'unit-box-mesh.tscn' });

    await waitFor(() => {
      expect(result.current.buffer).toBe(SECOND_TSCN);
    });

    // Resolving the first fixture's fetch must not stomp the second
    // (the effect was already cancelled via the `cancelled` flag).
    await act(async () => {
      first.resolve(FIXTURE_TSCN);
    });

    expect(result.current.buffer).toBe(SECOND_TSCN);
    expect(result.current.forwardedContent).toBe(SECOND_TSCN);
  });
});
