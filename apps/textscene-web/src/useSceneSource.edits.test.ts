/**
 * `useSceneSource` — the debounced edit forward, and the gate it hands the buffer to.
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
  GARBAGE,
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
// Hold-last-valid invariant: late fetch resolution after a keystroke is dropped
// ---------------------------------------------------------------------------

describe('debounced edit forward', () => {
  it('does not forward immediately on a keystroke', async () => {
    globalThis.fetch = mockFetchOk(FIXTURE_TSCN);

    const { result } = renderHook(() =>
      useSceneSource({ fixtureFile: 'unit-plane-mesh.tscn', uploadedTscnName: null })
    );

    await waitFor(() => {
      expect(result.current.buffer).toBe(FIXTURE_TSCN);
    });
    const beforeForward = result.current.forwardedContent;

    act(() => {
      result.current.onBufferChange(VALID_EDIT_TSCN);
    });

    // Buffer updates immediately but forwardedContent is still the last fetched value.
    expect(result.current.buffer).toBe(VALID_EDIT_TSCN);
    expect(result.current.forwardedContent).toBe(beforeForward);
  });

  it('forwards a valid edit after the debounce delay', async () => {
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

    await settle(300);

    expect(result.current.forwardedContent).toBe(VALID_EDIT_TSCN);
  });

  it('holds forwardedContent when the debounced buffer is garbage (gate rejects it)', async () => {
    globalThis.fetch = mockFetchOk(FIXTURE_TSCN);

    const { result } = renderHook(() =>
      useSceneSource({ fixtureFile: 'unit-plane-mesh.tscn', uploadedTscnName: null })
    );

    await waitFor(() => {
      expect(result.current.buffer).toBe(FIXTURE_TSCN);
    });

    act(() => {
      result.current.onBufferChange(GARBAGE);
    });

    await settle(300);

    expect(result.current.buffer).toBe(GARBAGE);
    // Gate rejected the garbage — hold last valid.
    expect(result.current.forwardedContent).toBe(FIXTURE_TSCN);
  });

  it('clears loadError when the user edits the buffer', async () => {
    // Start with a failed load to set loadError.
    globalThis.fetch = mockFetchFail();

    const { result } = renderHook(() =>
      useSceneSource({ fixtureFile: 'unit-plane-mesh.tscn', uploadedTscnName: null })
    );

    await waitFor(() => {
      expect(result.current.loadError).toBeTruthy();
    });

    act(() => {
      result.current.onBufferChange(VALID_EDIT_TSCN);
    });

    expect(result.current.loadError).toBeNull();
  });
});
