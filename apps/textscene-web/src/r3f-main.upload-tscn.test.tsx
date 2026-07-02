/**
 * WI-UX-7 regression: the toolbar's "Upload TSCN" file input lets the
 * user load a .tscn file from disk. The parsed scene tree must populate
 * with the uploaded content's root nodes, and the dropdown should
 * deselect so the user knows they're not on a fixture anymore.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';

// `<TscnCanvas>` mounts a real WebGL `<Canvas>` which happy-dom can't
// provide. Substitute a stub so the rest of the shell renders.
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

const UPLOADED_TSCN = `[gd_scene load_steps=1 format=3]

[node name="UploadedRoot" type="Node3D"]

[node name="UploadedChild" type="Node3D" parent="UploadedRoot"]
`;

beforeEach(() => {
  // Default fixture fetch on mount — return any valid TSCN so the shell
  // settles into a non-empty state before the test simulates an upload.
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: true,
    text: () => Promise.resolve('[gd_scene load_steps=1 format=3]\n\n[node name="FixtureRoot" type="Node3D"]\n'),
  } as unknown as Response) as unknown as typeof fetch;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('<R3FApp> Upload TSCN (WI-UX-7)', () => {
  it('replaces the active scene with parsed nodes from an uploaded .tscn file', async () => {
    render(<R3FApp />);

    // The default fixture loads first; wait for its root to appear in
    // the tree so we have a baseline.
    await waitFor(() => {
      expect(screen.queryByText('FixtureRoot')).toBeTruthy();
    });

    const uploadInput = screen.getByTestId('upload-tscn-input') as HTMLInputElement;
    expect(uploadInput).toBeTruthy();
    expect(uploadInput.accept).toBe('.tscn');

    const file = new File([UPLOADED_TSCN], 'my-scene.tscn', { type: 'text/plain' });
    await act(async () => {
      fireEvent.change(uploadInput, { target: { files: [file] } });
      // The reader.text() promise needs a microtask flush.
      await Promise.resolve();
    });

    // The uploaded scene's root appears in the tree, replacing the
    // fixture's root.
    await waitFor(() => {
      expect(screen.queryByText('UploadedRoot')).toBeTruthy();
    });
    expect(screen.queryByText('FixtureRoot')).toBeNull();
  });

  it('shows the uploaded file name in the toolbar after upload', async () => {
    render(<R3FApp />);

    await waitFor(() => {
      expect(screen.queryByText('FixtureRoot')).toBeTruthy();
    });

    const uploadInput = screen.getByTestId('upload-tscn-input') as HTMLInputElement;
    const file = new File([UPLOADED_TSCN], 'my-scene.tscn', { type: 'text/plain' });
    await act(async () => {
      fireEvent.change(uploadInput, { target: { files: [file] } });
      await Promise.resolve();
    });

    await waitFor(() => {
      const label = screen.queryByTestId('uploaded-tscn-label');
      expect(label).toBeTruthy();
      expect(label?.textContent).toBe('my-scene.tscn');
    });
  });

  it('reflects the uploaded file in the scene switcher (the native dropdown is gone)', async () => {
    // The old native <select> was replaced by the command-palette scene
    // switcher (the built-in fixtures are dev-only scaffolding). After an
    // upload the scene chip shows the uploaded filename — signalling "not on a
    // fixture" — and there is no longer a combobox in the DOM.
    render(<R3FApp />);

    await waitFor(() => {
      expect(screen.queryByText('FixtureRoot')).toBeTruthy();
    });

    const uploadInput = screen.getByTestId('upload-tscn-input') as HTMLInputElement;
    const file = new File([UPLOADED_TSCN], 'my-scene.tscn', { type: 'text/plain' });
    await act(async () => {
      fireEvent.change(uploadInput, { target: { files: [file] } });
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(screen.getByTestId('uploaded-tscn-label').textContent).toBe('my-scene.tscn');
    });
    expect(screen.queryByRole('combobox')).toBeNull();
  });

  it('renders the Reset Camera button, disabled until a scene is loaded', async () => {
    // Have the default fixture fetch fail so we start with no content.
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      statusText: 'Not Found',
    } as unknown as Response) as unknown as typeof fetch;

    render(<R3FApp />);

    const button = (await screen.findByTestId('reset-camera-button')) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });

  it('enables Reset Camera once content is loaded', async () => {
    render(<R3FApp />);

    await waitFor(() => {
      expect(screen.queryByText('FixtureRoot')).toBeTruthy();
    });

    const button = screen.getByTestId('reset-camera-button') as HTMLButtonElement;
    expect(button.disabled).toBe(false);
  });

  it('keeps Reset Camera disabled when content is non-empty but parses to no scene (WI-UX-7c)', async () => {
    // Malformed fixture: bytes load successfully but the lenient parser
    // extracts zero nodes. Slice 2's gate returns lastGood ('') for this case,
    // so the shell sees empty content and Reset Camera stays disabled.
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve('[this is { not valid tscn at all'),
    } as unknown as Response) as unknown as typeof fetch;

    render(<R3FApp />);

    const button = screen.getByTestId('reset-camera-button') as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });
});
