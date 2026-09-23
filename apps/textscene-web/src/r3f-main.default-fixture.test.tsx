/**
 * A first-time visitor (empty localStorage) lands on a fixture with no `ext_resource` lines,
 * so the first paint shows a clean scene rather than missing-file warnings.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

vi.mock('@textscene/core', async () => {
  const real = await vi.importActual<typeof import('@textscene/core')>(
    '@textscene/core'
  );
  return {
    ...real,
    TscnCanvas: () => null,
    TscnSceneContents: () => null,
  };
});

import { R3FApp } from './r3f-main';

// Any TSCN that produces a sceneGraph: the test asserts the requested fixture through the
// mocked fetch URL.
const STUB_TSCN = `[gd_scene load_steps=1 format=3]

[node name="StubRoot" type="Node3D"]
`;

let fetchSpy: ReturnType<typeof vi.fn>;

beforeEach(() => {
  // Make sure no prior session's choice leaks in.
  try {
    globalThis.localStorage.removeItem('tscn-web-r3f-fixture');
  } catch {
    // happy-dom can throw here, and clearing storage is optional.
  }
  // A fixture load writes `?fixture=` to the URL, and a stale deep link would outrank the
  // localStorage choice in the next test.
  window.history.replaceState(null, '', '/');
  fetchSpy = vi.fn().mockResolvedValue({
    ok: true,
    text: () => Promise.resolve(STUB_TSCN),
  } as unknown as Response);
  globalThis.fetch = fetchSpy as unknown as typeof fetch;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('<R3FApp> default fixture on first visit (WI-UX-15)', () => {
  it('fetches the zero-externals fixture (unit-plane-mesh.tscn) on first paint', async () => {
    render(<R3FApp />);

    // The scene tree shows the fetch resolved and the shell parsed the content.
    await waitFor(() => {
      expect(screen.queryByText('StubRoot')).toBeTruthy();
    });

    const fetchedUrls = fetchSpy.mock.calls.map((c) => String(c[0]));
    // With empty localStorage, the requested fixture is the no-externals scene.
    expect(fetchedUrls).toContain('/fixtures/unit-plane-mesh.tscn');
  });

  it('respects a stored fixture choice over the default (returning visitor)', async () => {
    globalThis.localStorage.setItem('tscn-web-r3f-fixture', 'unit-box-mesh.tscn');

    render(<R3FApp />);

    await waitFor(() => {
      expect(screen.queryByText('StubRoot')).toBeTruthy();
    });

    const fetchedUrls = fetchSpy.mock.calls.map((c) => String(c[0]));
    expect(fetchedUrls).toContain('/fixtures/unit-box-mesh.tscn');
    expect(fetchedUrls).not.toContain('/fixtures/unit-plane-mesh.tscn');
  });
});
