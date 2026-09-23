/**
 * Drag-and-drop onto the app. `fireEvent.drop` and `dragOver` take a plain object for
 * `dataTransfer`: React reads only `.files` from it, and happy-dom has no `DataTransfer`.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

vi.mock('@textscene/core', async () => {
  const real = await vi.importActual<typeof import('@textscene/core')>('@textscene/core');
  return { ...real, TscnCanvas: () => null, TscnSceneContents: () => null };
});

import { R3FApp } from './r3f-main';

const STUB_TSCN = `[gd_scene load_steps=1 format=3]

[node name="StubRoot" type="Node3D"]
`;

const DROPPED_TSCN = `[gd_scene load_steps=1 format=3]

[node name="DroppedRoot" type="Node3D"]
`;

function resetPersistence() {
  try {
    globalThis.localStorage.clear();
  } catch {
    // happy-dom can throw here, and clearing storage is optional.
  }
  window.history.replaceState(null, '', '/');
}

function mockFetch() {
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: true,
    text: () => Promise.resolve(STUB_TSCN),
  } as unknown as Response) as unknown as typeof fetch;
}

async function waitForScene(rootName = 'StubRoot') {
  await waitFor(() => {
    expect(screen.queryByText(rootName)).toBeTruthy();
  });
}

function dropFiles(files: File[]) {
  const target = screen.getByTestId('app-root');
  fireEvent.dragEnter(target, { dataTransfer: { files, types: ['Files'] } });
  fireEvent.dragOver(target, { dataTransfer: { files, types: ['Files'] } });
  fireEvent.drop(target, { dataTransfer: { files, types: ['Files'] } });
}

beforeEach(() => {
  resetPersistence();
  mockFetch();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('#221 drag-and-drop a .tscn file', () => {
  it('loads a dropped .tscn file as the active scene', async () => {
    render(<R3FApp />);
    await waitForScene();

    const file = new File([DROPPED_TSCN], 'dropped-scene.tscn', { type: 'text/plain' });
    await waitFor(() => {
      dropFiles([file]);
    });

    await waitForScene('DroppedRoot');
    expect(screen.getByTestId('uploaded-tscn-label').textContent).toBe('dropped-scene.tscn');
  });

  it('shows a drop-zone hint while a file is being dragged over the page', async () => {
    render(<R3FApp />);
    await waitForScene();

    const target = screen.getByTestId('app-root');
    expect(screen.queryByTestId('drop-zone-hint')).toBeNull();

    fireEvent.dragEnter(target, { dataTransfer: { files: [], types: ['Files'] } });
    expect(screen.getByTestId('drop-zone-hint')).toBeTruthy();

    fireEvent.dragLeave(target, { dataTransfer: { files: [], types: ['Files'] } });
    expect(screen.queryByTestId('drop-zone-hint')).toBeNull();
  });

  it('ignores a drop with no .tscn file and surfaces an error', async () => {
    render(<R3FApp />);
    await waitForScene();

    const file = new File(['not a scene'], 'texture.png', { type: 'image/png' });
    dropFiles([file]);

    await waitFor(() => {
      expect(screen.queryByRole('alert')).toBeTruthy();
    });
    // The previously-loaded scene must still be showing (hold last valid).
    expect(screen.queryByText('StubRoot')).toBeTruthy();
  });

  it('leaves a drag carrying no files to the browser', async () => {
    render(<R3FApp />);
    await waitForScene();

    const target = screen.getByTestId('app-root');
    // A selection dragged inside the Source textarea: `preventDefault()` would cancel the
    // browser's own text insertion, and the ingest would raise a false "no .tscn" error.
    const textDrag = { dataTransfer: { files: [], types: ['text/plain'] } };

    // `fireEvent` returns false once a handler has prevented the default.
    expect(fireEvent.dragEnter(target, textDrag)).toBe(true);
    expect(fireEvent.dragOver(target, textDrag)).toBe(true);
    expect(fireEvent.drop(target, textDrag)).toBe(true);

    expect(screen.queryByTestId('drop-zone-hint')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByText('StubRoot')).toBeTruthy();
  });

  it('treats a file drag that carries no files as a no-op, not an error', async () => {
    render(<R3FApp />);
    await waitForScene();

    dropFiles([]);

    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByText('StubRoot')).toBeTruthy();
  });
});
