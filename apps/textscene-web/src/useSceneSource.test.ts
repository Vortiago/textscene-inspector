/**
 * Unit tests for `useSceneSource` — the hook that owns the hold-last-valid
 * edit-loop invariant (ADR-0020).
 *
 * Invariant: a resolving fixture load must never stomp newer keystrokes.
 * Tested paths:
 *   - Fixture load: fetch resolves → buffer + forwardedContent set together
 *   - Fetch failure: buffer cleared, forwardedContent HELD (last valid render preserved)
 *   - Late fetch after keystroke: editedSinceLoad guard, load resolution ignored
 *   - Upload (replace): supersedes any pending debounce, sets both buffer + forwardedContent
 *   - Debounced edit forward: keystroke arms a timer, resolveForwardedContent called after delay
 *   - Fixture switch: fetches new content, resets editedSinceLoad so stale prior fetch is dropped
 *   - renderedFixtureFile: what the RENDER came from, and clearRender's
 *     buffer-preserving teardown
 *   - onBeforeSwap: fires once per authoritative fixture swap, in the same turn
 *     as the content replace — the seam the corpus root is re-pointed on
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';

// Stub resolveForwardedContent: valid TSCN passes through, garbage is rejected.
vi.mock('./sourceGate', () => ({
  resolveForwardedContent: (buffer: string, lastGood: string) =>
    buffer.trim().startsWith('[gd_scene') ? buffer : lastGood,
}));

import { useSceneSource } from './useSceneSource';
import type { UseSceneSourceOptions, UseSceneSourceResult } from './useSceneSource';

const FIXTURE_TSCN = `[gd_scene load_steps=1 format=3]

[node name="FixtureRoot" type="Node3D"]
`;

const SECOND_TSCN = `[gd_scene load_steps=1 format=3]

[node name="SecondRoot" type="Node3D"]
`;

const UPLOADED_TSCN = `[gd_scene load_steps=1 format=3]

[node name="UploadedRoot" type="Node3D"]
`;

const VALID_EDIT_TSCN = `[gd_scene load_steps=1 format=3]

[node name="EditedRoot" type="Node3D"]
`;

const GARBAGE = 'not valid tscn at all }{ ]] [[';

/** Manually-resolved deferred so tests can control when a fetch resolves. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function mockFetchOk(text: string) {
  return vi.fn().mockResolvedValue({
    ok: true,
    text: () => Promise.resolve(text),
  } as unknown as Response) as unknown as typeof fetch;
}

function mockFetchFail() {
  return vi.fn().mockResolvedValue({
    ok: false,
    statusText: 'Not Found',
  } as unknown as Response) as unknown as typeof fetch;
}

/** Let real time pass so a debounce timer fires. */
async function settle(ms: number) {
  await act(async () => {
    await new Promise((r) => setTimeout(r, ms));
  });
}

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
// Hold-last-valid invariant: late fetch resolution after a keystroke is dropped
// ---------------------------------------------------------------------------

describe('hold-last-valid invariant — late fetch after keystroke', () => {
  it('drops a fetch resolution that arrives after the user has edited the buffer', async () => {
    // Hold the fetch open so we can resolve it manually AFTER the edit.
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

    // User edits before the fetch resolves — sets editedSinceLoad.
    act(() => {
      result.current.onBufferChange(VALID_EDIT_TSCN);
    });

    // Advance time past the debounce so the edit forward fires.
    await settle(300);

    expect(result.current.buffer).toBe(VALID_EDIT_TSCN);
    expect(result.current.forwardedContent).toBe(VALID_EDIT_TSCN);

    // Now the fetch resolves — it must NOT stomp the user's edit.
    await act(async () => {
      fetchText.resolve(FIXTURE_TSCN);
    });

    // Buffer and forwardedContent must still hold the user's edit.
    expect(result.current.buffer).toBe(VALID_EDIT_TSCN);
    expect(result.current.forwardedContent).toBe(VALID_EDIT_TSCN);
  });
});

// ---------------------------------------------------------------------------
// Debounced edit forward
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

    const { result, rerender } = renderHook<UseSceneSourceResult, UseSceneSourceOptions>(
      (props) => useSceneSource(props),
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

    // Authoritative replace (upload) — pane holds known content again.
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

// ---------------------------------------------------------------------------
// reload — the only way back from a failed load
// ---------------------------------------------------------------------------

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

    // An upload has no fixture to refetch — the uploaded content must survive.
    expect(result.current.forwardedContent).toBe(UPLOADED_TSCN);
    expect(globalThis.fetch).not.toHaveBeenCalled();
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
