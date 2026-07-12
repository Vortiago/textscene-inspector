/**
 * Issue #221 — drag-and-drop: no drop handling existed today; upload was a
 * hidden file input only. Reuses the `r3f-main.*.test.tsx` WebGL-mock
 * pattern. `fireEvent.drop`/`dragOver` accept a plain object for
 * `dataTransfer` — React only reads `.files` off it, so a real
 * `DataTransfer` (unavailable in happy-dom) isn't needed.
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
    // happy-dom may throw in edge cases; ignore.
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
});
