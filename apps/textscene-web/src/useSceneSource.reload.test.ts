/**
 * `useSceneSource`'s `reload`, which refetches at an unchanged `fixtureFile`.
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
  UPLOADED_TSCN,
  mockFetchFail,
  mockFetchOk,
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

describe('reload — refetch at an unchanged fixtureFile', () => {
  it('recovers the render after a failed load', async () => {
    let attempt = 0;
    globalThis.fetch = vi.fn().mockImplementation(async () => {
      attempt += 1;
      if (attempt === 1) return { ok: false, statusText: 'Not Found' } as Response;
      return { ok: true, text: () => Promise.resolve(FIXTURE_TSCN) } as unknown as Response;
    }) as unknown as typeof fetch;

    const { result } = renderHook(() =>
      useSceneSource({ fixtureFile: 'unit-plane-mesh.tscn', uploadedTscnName: null })
    );

    await waitFor(() => {
      expect(result.current.loadError).toBeTruthy();
    });

    await act(async () => {
      result.current.reload();
    });

    await waitFor(() => {
      expect(result.current.forwardedContent).toBe(FIXTURE_TSCN);
    });
    expect(result.current.loadError).toBeNull();
    expect(result.current.renderedFixtureFile).toBe('unit-plane-mesh.tscn');
    expect(attempt).toBe(2);
  });

  it('re-announces the swap so the host can re-point resolution on the retry', async () => {
    let attempt = 0;
    globalThis.fetch = vi.fn().mockImplementation(async () => {
      attempt += 1;
      if (attempt === 1) return { ok: false, statusText: 'Not Found' } as Response;
      return { ok: true, text: () => Promise.resolve(FIXTURE_TSCN) } as unknown as Response;
    }) as unknown as typeof fetch;

    const onBeforeSwap = vi.fn();
    const { result } = renderHook(() =>
      useSceneSource({
        fixtureFile: 'unit-plane-mesh.tscn',
        uploadedTscnName: null,
        onBeforeSwap,
      })
    );
    await waitFor(() => {
      expect(result.current.loadError).toBeTruthy();
    });
    expect(onBeforeSwap).not.toHaveBeenCalled();

    await act(async () => {
      result.current.reload();
    });

    await waitFor(() => {
      expect(onBeforeSwap).toHaveBeenCalledWith('unit-plane-mesh.tscn');
    });
  });

  it('reports a retry that fails the same way as a new failure', async () => {
    globalThis.fetch = mockFetchFail();

    const { result } = renderHook(() =>
      useSceneSource({ fixtureFile: 'unit-plane-mesh.tscn', uploadedTscnName: null })
    );
    await waitFor(() => {
      expect(result.current.loadError).toBeTruthy();
    });
    const firstFailure = result.current.loadError;

    await act(async () => {
      result.current.reload();
    });

    // The banner orders its channels by failure, so an equal message must not read as the same one.
    await waitFor(() => {
      expect(result.current.loadError).not.toBeNull();
      expect(result.current.loadError).not.toBe(firstFailure);
    });
    expect(result.current.loadError?.message).toBe(firstFailure?.message);
  });

  it('is a no-op for the render when there is no fixture selected', async () => {
    globalThis.fetch = mockFetchOk(FIXTURE_TSCN);

    const { result } = renderHook(() =>
      useSceneSource({ fixtureFile: '', uploadedTscnName: 'uploaded.tscn' })
    );

    act(() => {
      result.current.replace(UPLOADED_TSCN);
    });

    await act(async () => {
      result.current.reload();
    });

    // An upload has no fixture to refetch, so the uploaded content must survive.
    expect(result.current.forwardedContent).toBe(UPLOADED_TSCN);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
});
