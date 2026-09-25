/**
 * The dev edition (no `VITE_SITE_EDITION`, Cloudflare Pages and `pnpm dev`): the built-in
 * scenes and the parity gallery link. `r3f-main.public-site.test.tsx` pins the other edition.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';

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

const INSTANCING_TSCN = `[gd_scene format=3]

[ext_resource type="PackedScene" path="res://door.tscn" id="1"]

[node name="Room" type="Node3D"]

[node name="Door" parent="." instance=ExtResource("1")]
`;

/** Opens the instancing scene through the file input and expands its root row. */
async function openInstancingScene() {
  fireEvent.change(screen.getByTestId('upload-tscn-input'), {
    target: { files: [new File([INSTANCING_TSCN], 'room.tscn')] },
  });
  const roomRow = (await screen.findByText('Room')).closest('[data-node-path]') as HTMLElement;
  fireEvent.click(within(roomRow).getByRole('button', { name: 'Expand' }));
  await screen.findByText('Door');
}

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

  it('offers the open-sub-scene action on an instanced scene', async () => {
    render(<R3FApp />);
    // The default fixture settles first, so its fetch cannot land over the upload.
    await screen.findByText('StubRoot');

    await openInstancingScene();

    expect(screen.getByLabelText('Open sub-scene standalone')).toBeTruthy();
  });
});
