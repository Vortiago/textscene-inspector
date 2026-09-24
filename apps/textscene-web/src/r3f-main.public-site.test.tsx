/**
 * The public edition (`VITE_SITE_EDITION=public`, GitHub Pages): no built-in scenes, no
 * parity gallery link and no request to the fixtures mirror, so the app opens empty and
 * waits for the user's own file.
 */
import { describe, expect, it, vi, beforeEach, afterEach, afterAll } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

// Before the imports below: `siteEdition.ts` reads the variable when it first loads.
vi.hoisted(() => {
  vi.stubEnv('VITE_SITE_EDITION', 'public');
});

// `<TscnCanvas>` mounts a WebGL `<Canvas>` that happy-dom cannot provide.
vi.mock('@textscene/core', async () => {
  const real = await vi.importActual<typeof import('@textscene/core')>('@textscene/core');
  return { ...real, TscnCanvas: () => null, TscnSceneContents: () => null };
});

import { R3FApp } from './r3f-main';
import { fixtures } from './fixturesAll';
import { IS_PUBLIC_SITE } from './siteEdition';

const UPLOADED_TSCN = `[gd_scene format=3]

[node name="UploadedRoot" type="Node3D"]
`;

beforeEach(() => {
  window.history.replaceState(null, '', '/');
  window.localStorage.clear();
});

afterEach(() => {
  window.history.replaceState(null, '', '/');
});

afterAll(() => {
  vi.unstubAllEnvs();
});

describe('public site edition', () => {
  it('reads the edition from VITE_SITE_EDITION', () => {
    expect(IS_PUBLIC_SITE).toBe(true);
  });

  it('lists no built-in scenes', () => {
    expect(fixtures).toEqual([]);
  });

  it('opens with no scene and fetches nothing', async () => {
    render(<R3FApp />);

    expect(await screen.findByText('No scene')).toBeTruthy();
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('shows no parity gallery link', () => {
    render(<R3FApp />);

    expect(screen.queryByText('Parity')).toBeNull();
  });

  it('offers only the open action in the scene palette', () => {
    render(<R3FApp />);

    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });

    expect(screen.getByRole('dialog', { name: 'Open or switch scene' })).toBeTruthy();
    expect(screen.queryByLabelText('Filter built-in scenes')).toBeNull();
  });

  it('ignores a ?fixture= deep link from the dev edition', async () => {
    window.history.replaceState(null, '', '/?fixture=demos/2d/platformer/player.tscn');

    render(<R3FApp />);

    await waitFor(() =>
      expect(new URL(window.location.href).searchParams.has('fixture')).toBe(false)
    );
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('renders a scene the user opens, with no fixtures request', async () => {
    render(<R3FApp />);

    fireEvent.change(screen.getByTestId('upload-tscn-input'), {
      target: { files: [new File([UPLOADED_TSCN], 'uploaded.tscn')] },
    });

    expect(await screen.findByText('UploadedRoot')).toBeTruthy();
    expect(screen.getByTestId('uploaded-tscn-label').textContent).toBe('uploaded.tscn');
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
});
