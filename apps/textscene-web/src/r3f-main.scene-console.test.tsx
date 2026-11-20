import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import { variant } from '@textscene/renderer';
import { R3FApp } from './r3f-main';

const LEVEL = `[gd_scene load_steps=1 format=3]

[node name="Level" type="Node3D"]
`;

beforeEach(() => {
  try {
    globalThis.localStorage.removeItem('tscn-web-r3f-fixture');
  } catch {
    // happy-dom can throw here, and clearing storage is optional.
  }
  window.history.replaceState(null, '', '/');
  globalThis.fetch = vi
    .fn()
    .mockResolvedValue({ ok: true, text: () => Promise.resolve(LEVEL) } as unknown as Response);
});

afterEach(() => {
  vi.restoreAllMocks();
  delete window.textscene;
});

describe('<R3FApp> scene console', () => {
  it('puts the scene it shows on window.textscene, under the fixture’s res:// path', async () => {
    render(<R3FApp />);
    await waitFor(() => expect(screen.queryByText('Level')).toBeTruthy());

    expect(window.textscene?.scene.rootScenePath).toBe('res://unit-plane-mesh.tscn');
    expect(window.textscene?.variant).toBe(variant);
  });

  it('draws a host text set on that scene', async () => {
    render(<R3FApp />);
    await waitFor(() => expect(screen.queryByText('Level')).toBeTruthy());

    act(() => window.textscene!.scene.setSource(LEVEL.replace('"Level"', '"Arena"')));

    await waitFor(() => expect(screen.queryByText('Arena')).toBeTruthy());
  });
});
