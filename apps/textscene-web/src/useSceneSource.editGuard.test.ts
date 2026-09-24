/**
 * `useSceneSource`: the guard that keeps a resolving load from stomping newer keystrokes.
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
  VALID_EDIT_TSCN,
  GARBAGE,
  deferred,
  mockFetchOk,
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

describe('hold-last-valid invariant — late fetch after keystroke', () => {
  it('drops a fetch resolution that arrives after the user has edited the buffer', async () => {
    // The fetch stays open, to resolve after the edit.
    const fetchText = deferred<string>();
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: () => fetchText.promise,
    } as unknown as Response) as unknown as typeof fetch;

    const { result } = renderHook(() =>
      useSceneSource({ fixtureFile: 'unit-plane-mesh.tscn', uploadedTscnName: null })
    );

    await waitFor(() => {
      expect(result.current.isFetching).toBe(true);
    });

    // The user edits before the fetch resolves, which sets editedSinceLoad.
    act(() => {
      result.current.onBufferChange(VALID_EDIT_TSCN);
    });

    // Advance time past the debounce so the edit forward fires.
    await settle(300);

    expect(result.current.buffer).toBe(VALID_EDIT_TSCN);
    expect(result.current.forwardedContent).toBe(VALID_EDIT_TSCN);

    // The fetch resolves and must not overwrite the user's edit.
    await act(async () => {
      fetchText.resolve(FIXTURE_TSCN);
    });

    // Buffer and forwardedContent must still hold the user's edit.
    expect(result.current.buffer).toBe(VALID_EDIT_TSCN);
    expect(result.current.forwardedContent).toBe(VALID_EDIT_TSCN);
  });
});

describe('editedSinceLoad — the discard-guard predicate', () => {
  it('is false after a load, true after a keystroke, false again after replace and after a new fixture load', async () => {
    globalThis.fetch = mockFetchOk(FIXTURE_TSCN);

    const { result, rerender } = renderHook(
      ({ fixtureFile }: { fixtureFile: string }) =>
        useSceneSource({ fixtureFile, uploadedTscnName: null }),
      { initialProps: { fixtureFile: 'unit-plane-mesh.tscn' } }
    );
    await waitFor(() => {
      expect(result.current.buffer).toBe(FIXTURE_TSCN);
    });
    expect(result.current.editedSinceLoad()).toBe(false);

    act(() => {
      result.current.onBufferChange(GARBAGE);
    });
    expect(result.current.editedSinceLoad()).toBe(true);

    // An upload's replace: the pane holds known content again.
    act(() => {
      result.current.replace(UPLOADED_TSCN);
    });
    expect(result.current.editedSinceLoad()).toBe(false);

    // Edit again, then a new fixture load resets the flag.
    act(() => {
      result.current.onBufferChange(GARBAGE);
    });
    expect(result.current.editedSinceLoad()).toBe(true);
    rerender({ fixtureFile: 'unit-box-mesh.tscn' });
    await waitFor(() => {
      expect(result.current.editedSinceLoad()).toBe(false);
    });
  });
});
