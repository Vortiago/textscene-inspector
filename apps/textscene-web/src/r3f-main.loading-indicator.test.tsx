/**
 * Loading indicator: the fixture fetch has no pending state
 * today (only success/failure), so a slow fixture load looks identical to a
 * stuck app. Reuses the `r3f-main.*.test.tsx` WebGL-mock pattern; the
 * fetch's `.text()` promise is held open with a manually-resolved deferred
 * so the test can observe the in-flight state before resolving it.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

vi.mock('@textscene/core', async () => {
  const real = await vi.importActual<typeof import('@textscene/core')>('@textscene/core');
  return { ...real, TscnCanvas: () => null, TscnSceneContents: () => null };
});

import { R3FApp } from './r3f-main';

const STUB_TSCN = `[gd_scene load_steps=1 format=3]

[node name="StubRoot" type="Node3D"]
`;

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

function resetPersistence() {
  try {
    globalThis.localStorage.clear();
  } catch {
    // happy-dom may throw in edge cases; ignore.
  }
}

beforeEach(() => {
  resetPersistence();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('#221 fixture-fetch loading indicator', () => {
  it('shows a loading indicator while the fixture fetch is in flight, then hides it once resolved', async () => {
    const text = deferred<string>();
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: () => text.promise,
    } as unknown as Response) as unknown as typeof fetch;

    render(<R3FApp />);

    await waitFor(() => {
      expect(screen.queryByTestId('fixture-loading')).toBeTruthy();
    });
    expect(screen.queryByText('StubRoot')).toBeNull();

    text.resolve(STUB_TSCN);

    await waitFor(() => {
      expect(screen.queryByText('StubRoot')).toBeTruthy();
    });
    expect(screen.queryByTestId('fixture-loading')).toBeNull();
  });

  it('hides the loading indicator once the fetch fails', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      statusText: 'Not Found',
    } as unknown as Response) as unknown as typeof fetch;

    render(<R3FApp />);

    await waitFor(() => {
      expect(screen.queryByRole('alert')).toBeTruthy();
    });
    expect(screen.queryByTestId('fixture-loading')).toBeNull();
  });
});
