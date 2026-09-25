/**
 * The toolbar's "Upload TSCN" file input: the scene tree shows the uploaded content's root
 * nodes, and the scene chip shows that no fixture is active.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';

// happy-dom cannot provide the WebGL `<Canvas>` that `<TscnCanvas>` mounts, so it is a stub.
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
  // Any valid TSCN for the default fixture, so the shell settles before the upload.
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

    // The default fixture's root in the tree is the baseline.
    await waitFor(() => {
      expect(screen.queryByText('FixtureRoot')).toBeTruthy();
    });

    const uploadInput = screen.getByTestId('upload-tscn-input') as HTMLInputElement;
    expect(uploadInput).toBeTruthy();
    // `accept` holds every resource kind handleFilesUpload's basename matching resolves.
    expect(uploadInput.accept).toContain('.tscn');

    const file = new File([UPLOADED_TSCN], 'my-scene.tscn', { type: 'text/plain' });
    await act(async () => {
      fireEvent.change(uploadInput, { target: { files: [file] } });
      // The reader.text() promise needs a microtask flush.
      await Promise.resolve();
    });

    // The uploaded scene's root replaces the fixture's root in the tree.
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
    // The scene switcher is a command palette, not a combobox. After an upload the scene chip
    // shows the uploaded file name, so no fixture is active.
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
    // The bytes load, but the lenient parser finds zero nodes, so `sceneGraph === null` with
    // an error banner. The button stays disabled, which a gate on `content.length` would miss.
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve('[this is { not valid tscn at all'),
    } as unknown as Response) as unknown as typeof fetch;

    render(<R3FApp />);

    // The parse-error banner shows the shell applied the content and parsed it.
    await waitFor(() => {
      expect(screen.queryByRole('alert')).toBeTruthy();
    });

    const button = screen.getByTestId('reset-camera-button') as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });
});
