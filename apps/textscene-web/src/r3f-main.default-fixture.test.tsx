/**
 * WI-UX-15 regression: a first-time visitor (empty localStorage) lands
 * on a fixture with zero `ext_resource` lines, so the first paint shows
 * a clean scene rather than a wall of missing-file warnings.
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

// Minimal TSCN body the lenient parser can extract a Root from. The
// content is irrelevant beyond "produces a sceneGraph"; the test
// asserts which fixture was requested via the mocked fetch URL.
const STUB_TSCN = `[gd_scene load_steps=1 format=3]

[node name="StubRoot" type="Node3D"]
`;

let fetchSpy: ReturnType<typeof vi.fn>;

beforeEach(() => {
  // Make sure no prior session's choice leaks in.
  try {
    globalThis.localStorage.removeItem('tscn-web-r3f-fixture');
  } catch {
    // happy-dom may throw in some edge cases; ignore.
  }
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

    // Wait for the scene-tree to render — confirms the fetch resolved
    // and the shell parsed the content.
    await waitFor(() => {
      expect(screen.queryByText('StubRoot')).toBeTruthy();
    });

    const fetchedUrls = fetchSpy.mock.calls.map((c) => String(c[0]));
    // First-time visitor (empty localStorage) — the requested fixture
    // must be the no-externals scene, not Hallway or All Primitives.
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
