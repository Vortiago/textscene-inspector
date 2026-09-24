/**
 * The dev edition (no `VITE_SITE_EDITION`, Cloudflare Pages and `pnpm dev`): the built-in
 * scenes and the parity gallery link. `r3f-main.public-site.test.tsx` pins the other edition.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

vi.mock('@textscene/core', async () => {
  const real = await vi.importActual<typeof import('@textscene/core')>('@textscene/core');
  return { ...real, TscnCanvas: () => null, TscnSceneContents: () => null };
});

import { R3FApp } from './r3f-main';
import { fixtures } from './fixturesAll';
import { IS_PUBLIC_SITE } from './siteEdition';

const STUB_TSCN = `[gd_scene format=3]

[node name="StubRoot" type="Node3D"]
`;

beforeEach(() => {
  window.history.replaceState(null, '', '/');
  window.localStorage.clear();
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: true,
    text: () => Promise.resolve(STUB_TSCN),
  } as unknown as Response) as unknown as typeof fetch;
});

describe('dev site edition', () => {
  it('is the edition when VITE_SITE_EDITION is unset', () => {
    expect(import.meta.env.VITE_SITE_EDITION).toBeUndefined();
    expect(IS_PUBLIC_SITE).toBe(false);
  });

  it('lists the built-in scenes', () => {
    expect(fixtures.length).toBeGreaterThan(0);
  });

  it('links the parity gallery beside the app', () => {
    render(<R3FApp />);

    expect(screen.getByText('Parity').closest('a')?.getAttribute('href')).toBe(
      'parity/index.html'
    );
  });

  it('offers the built-in scenes in the scene palette', () => {
    render(<R3FApp />);

    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });

    expect(screen.getByLabelText('Filter built-in scenes')).toBeTruthy();
  });
});
