/**
 * `useSceneSource` — what the RENDER came from, and the teardown that empties it without touching the buffer.
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
  UPLOADED_TSCN,
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

// ---------------------------------------------------------------------------
// renderedFixtureFile + onBeforeSwap: the corpus-boundary seam
// ---------------------------------------------------------------------------

describe('renderedFixtureFile — the fixture the RENDERED content came from', () => {
  it('stays empty while the fetch is in flight, then names the fixture once it lands', async () => {
    const text = deferred<string>();
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: () => text.promise,
    } as unknown as Response) as unknown as typeof fetch;

    const { result } = renderHook(() =>
      useSceneSource({ fixtureFile: 'unit-plane-mesh.tscn', uploadedTscnName: null })
    );

    // The selection has already moved on; nothing is rendered from it yet.
    await waitFor(() => {
      expect(result.current.isFetching).toBe(true);
    });
    expect(result.current.renderedFixtureFile).toBe('');

    await act(async () => {
      text.resolve(FIXTURE_TSCN);
    });

    expect(result.current.renderedFixtureFile).toBe('unit-plane-mesh.tscn');
  });

  it('is empty for an uploaded scene — an upload belongs to no fixture', async () => {
    globalThis.fetch = mockFetchOk(FIXTURE_TSCN);

    const { result } = renderHook(() =>
      useSceneSource({ fixtureFile: 'unit-plane-mesh.tscn', uploadedTscnName: null })
    );
    await waitFor(() => {
      expect(result.current.renderedFixtureFile).toBe('unit-plane-mesh.tscn');
    });

    act(() => {
      result.current.replace(UPLOADED_TSCN);
    });

    expect(result.current.renderedFixtureFile).toBe('');
  });

  it('goes empty on clearRender while the buffer keeps the outgoing source', async () => {
    globalThis.fetch = mockFetchOk(FIXTURE_TSCN);

    const { result } = renderHook(() =>
      useSceneSource({ fixtureFile: 'unit-plane-mesh.tscn', uploadedTscnName: null })
    );
    await waitFor(() => {
      expect(result.current.renderedFixtureFile).toBe('unit-plane-mesh.tscn');
    });

    act(() => {
      result.current.clearRender();
    });

    // The renderer holds nothing; the editor is untouched.
    expect(result.current.forwardedContent).toBe('');
    expect(result.current.renderedFixtureFile).toBe('');
    expect(result.current.buffer).toBe(FIXTURE_TSCN);
  });

  it('clearRender cancels a pending debounce, so no stale edit re-populates the render', async () => {
    globalThis.fetch = mockFetchOk(FIXTURE_TSCN);

    const { result } = renderHook(() =>
      useSceneSource({ fixtureFile: 'unit-plane-mesh.tscn', uploadedTscnName: null })
    );
    await waitFor(() => {
      expect(result.current.buffer).toBe(FIXTURE_TSCN);
    });

    act(() => {
      result.current.onBufferChange(VALID_EDIT_TSCN);
    });
    act(() => {
      result.current.clearRender();
    });

    await settle(500);

    expect(result.current.forwardedContent).toBe('');
    expect(result.current.renderedFixtureFile).toBe('');
  });
});

describe('clearRender — drops the stale error with the render it described', () => {
  it('clears loadError so a previous failure does not caption the blank viewport', async () => {
    globalThis.fetch = mockFetchFail();

    const { result } = renderHook(() =>
      useSceneSource({ fixtureFile: 'unit-plane-mesh.tscn', uploadedTscnName: null })
    );
    await waitFor(() => {
      expect(result.current.loadError).toBeTruthy();
    });

    act(() => {
      result.current.clearRender();
    });

    expect(result.current.loadError).toBeNull();
  });
});
