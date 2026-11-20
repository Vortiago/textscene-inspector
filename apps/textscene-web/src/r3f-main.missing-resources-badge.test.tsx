import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

// `vi.mock` keys by resolved path, and `ViewportArea` imports `TscnCanvas` by relative path.
vi.mock('../../../packages/textscene-core/src/r3f/TscnCanvas', async () => {
  const real = (await vi.importActual('../../../packages/textscene-core/src/r3f/TscnCanvas')) as Record<
    string,
    unknown
  >;
  return { ...real, TscnCanvas: () => null };
});

import { R3FApp } from './r3f-main';

const STUB_TSCN = `[gd_scene load_steps=1 format=3]

[node name="StubRoot" type="Node3D"]
`;

const SPRITE_TSCN = `[gd_scene format=3]

[ext_resource type="Texture2D" path="res://textures/missing.png" id="1"]

[node name="StubRoot" type="Sprite2D"]
texture = ExtResource("1")
`;

/** The scene that every fixture fetch answers. */
let fixtureText = SPRITE_TSCN;

function resetPersistence() {
  try {
    globalThis.localStorage.clear();
  } catch {
    // happy-dom can throw here, and clearing storage is optional.
  }
}

/** Every `.tscn` answers the fixture, and every other file is not found. */
function mockFetch() {
  globalThis.fetch = vi.fn(async (url: string | URL) =>
    String(url).endsWith('.tscn')
      ? ({ ok: true, status: 200, text: () => Promise.resolve(fixtureText) } as unknown as Response)
      : ({ ok: false, status: 404, text: () => Promise.resolve('') } as unknown as Response)
  ) as unknown as typeof fetch;
}

async function waitForScene(rootName = 'StubRoot') {
  await waitFor(() => {
    expect(screen.queryByText(rootName)).toBeTruthy();
  });
}

beforeEach(() => {
  fixtureText = SPRITE_TSCN;
  resetPersistence();
  mockFetch();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('#221 missing-resource badge', () => {
  it("shows a badge with the count of the scene's missing files", async () => {
    render(<R3FApp />);
    await waitForScene();

    await waitFor(() => {
      expect(screen.queryByTestId('missing-resources-badge')).toBeTruthy();
    });
    expect(screen.getByTestId('missing-resources-badge').textContent).toContain('1');
  });

  it('shows no badge for a scene that reads no file', async () => {
    fixtureText = STUB_TSCN;
    render(<R3FApp />);
    await waitForScene();

    expect(screen.queryByTestId('missing-resources-badge')).toBeNull();
  });
});
