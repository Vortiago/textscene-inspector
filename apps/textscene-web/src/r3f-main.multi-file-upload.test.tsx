/**
 * Issue #221 — multi-file upload via the toolbar's file input: a scene plus
 * its resource files, selected together, should open in one gesture instead
 * of requiring the missing-resource panel's per-path upload for each file.
 * Reuses the `r3f-main.*.test.tsx` WebGL-mock pattern.
 *
 * Under happy-dom (no WebGL) `TscnSceneContents` never mounts, so nothing
 * ever calls `useResource()` for the texture — there is no real render-side
 * signal to observe. Instead this spies on `WebResourceProvider.prototype
 * .addUploadedFile`, the exact seam `handleFilesUpload` calls through
 * (mirroring the single-path Resources-tab upload's own
 * `provider.addUploadedFile` call) — a real, non-mocked integration between
 * the file-input handler, the pure `matchResourceFiles` helper (already
 * covered by co-located unit tests), and the resource pipeline.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';

vi.mock('@textscene/core', async () => {
  const real = await vi.importActual<typeof import('@textscene/core')>('@textscene/core');
  return { ...real, TscnCanvas: () => null, TscnSceneContents: () => null };
});

import { R3FApp } from './r3f-main';
import { WebResourceProvider } from './providers/WebResourceProvider';

const STUB_TSCN = `[gd_scene load_steps=1 format=3]

[node name="StubRoot" type="Node3D"]
`;

const SCENE_WITH_TEXTURE = `[gd_scene load_steps=2 format=3]

[ext_resource type="Texture2D" path="res://textures/player.png" id="1_abc"]

[node name="MultiUploadRoot" type="Node3D"]
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

beforeEach(() => {
  resetPersistence();
  mockFetch();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('#221 multi-file upload via the file input', () => {
  it('accepts multiple files at once', async () => {
    render(<R3FApp />);
    await waitForScene();

    const input = screen.getByTestId('upload-tscn-input') as HTMLInputElement;
    expect(input.multiple).toBe(true);
  });

  it('loads the scene and matches the accompanying file to its res:// path', async () => {
    const addUploadedFileSpy = vi.spyOn(WebResourceProvider.prototype, 'addUploadedFile');

    render(<R3FApp />);
    await waitForScene();

    const sceneFile = new File([SCENE_WITH_TEXTURE], 'multi-scene.tscn', { type: 'text/plain' });
    const textureFile = new File(['fake-png-bytes'], 'player.png', { type: 'image/png' });
    const input = screen.getByTestId('upload-tscn-input') as HTMLInputElement;

    await act(async () => {
      fireEvent.change(input, { target: { files: [sceneFile, textureFile] } });
      await Promise.resolve();
    });

    await waitForScene('MultiUploadRoot');
    expect(screen.getByTestId('uploaded-tscn-label').textContent).toBe('multi-scene.tscn');

    expect(addUploadedFileSpy).toHaveBeenCalledWith('res://textures/player.png', textureFile);
  });

  it('loads the scene alone when no accompanying file matches anything it references', async () => {
    const addUploadedFileSpy = vi.spyOn(WebResourceProvider.prototype, 'addUploadedFile');

    render(<R3FApp />);
    await waitForScene();

    const sceneFile = new File([SCENE_WITH_TEXTURE], 'multi-scene.tscn', { type: 'text/plain' });
    const unrelatedFile = new File(['bytes'], 'unrelated.png', { type: 'image/png' });
    const input = screen.getByTestId('upload-tscn-input') as HTMLInputElement;

    await act(async () => {
      fireEvent.change(input, { target: { files: [sceneFile, unrelatedFile] } });
      await Promise.resolve();
    });

    await waitForScene('MultiUploadRoot');
    expect(addUploadedFileSpy).not.toHaveBeenCalled();
  });
});
