/**
 * Multi-file upload via the toolbar's file input and drag-and-drop.
 * Covers the Multi-file matching contract:
 * 1. Root-most scene pick (regardless of file order in the batch)
 * 2. Missing-list matching (non-tscn files fulfill missing res:// rows on
 *    repeated drops, not just the scene's direct ExtResources)
 * 3. No-.tscn drops fulfill missing rows instead of erroring
 *
 * Spies on `WebResourceProvider.prototype.addUploadedFile` — the exact seam
 * `handleFilesUpload` calls through — a real, non-mocked integration between
 * the file-input handler, the pure helpers in multiFileUpload.ts (already
 * covered by co-located unit tests), and the resource pipeline.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';

// Under happy-dom nothing mounts inside the Canvas, so no `useResource()`
// call ever reports a missing path. Tests that need missing rows inject them
// through this hoisted override, delivered via the SAME prop contract the
// production shell uses (`onMissingPathsChange`) — which is exactly the seam
// `handleFilesUpload` reads.
const missingPathsOverride = vi.hoisted(() => ({
  current: null as ReadonlySet<string> | null,
}));

vi.mock('@textscene/core', async () => {
  const real = await vi.importActual<typeof import('@textscene/core')>('@textscene/core');
  const React = await vi.importActual<typeof import('react')>('react');
  return {
    ...real,
    TscnCanvas: () => null,
    TscnSceneContents: () => null,
    TscnPreviewShell: (props: Parameters<typeof real.TscnPreviewShell>[0]) =>
      // Substitute the override AT the provider's own observer seam — no
      // parent effect racing the provider's report, no ordering dependency.
      React.createElement(real.TscnPreviewShell, {
        ...props,
        onMissingPathsChange: (paths: ReadonlySet<string>) =>
          props.onMissingPathsChange?.(missingPathsOverride.current ?? paths),
      }),
    useMissingResources: () => {
      const value = real.useMissingResources();
      return missingPathsOverride.current
        ? { ...value, missingPaths: missingPathsOverride.current }
        : value;
    },
  };
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

// Parent scene references child.tscn and a background texture.
const PARENT_SCENE = `[gd_scene load_steps=3 format=3]

[ext_resource type="PackedScene" path="res://scenes/child.tscn" id="1_abc"]
[ext_resource type="Texture2D" path="res://textures/bg.png" id="2_def"]

[node name="ParentRoot" type="Node3D"]
`;

// Child scene referenced by the parent.
const CHILD_SCENE = `[gd_scene load_steps=1 format=3]

[ext_resource type="Texture2D" path="res://textures/child_tex.png" id="1_xyz"]

[node name="ChildRoot" type="Node3D"]
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
  missingPathsOverride.current = null;
  vi.restoreAllMocks();
});

describe('multi-file upload via the file input', () => {
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

describe('root-most scene pick (acceptance criteria)', () => {
  it('picks the parent scene regardless of drop order (reversed batch)', async () => {
    const addUploadedFileSpy = vi.spyOn(WebResourceProvider.prototype, 'addUploadedFile');

    render(<R3FApp />);
    await waitForScene();

    const parentFile = new File([PARENT_SCENE], 'parent.tscn', { type: 'text/plain' });
    const childFile = new File([CHILD_SCENE], 'child.tscn', { type: 'text/plain' });
    const bgTexture = new File(['bg-bytes'], 'bg.png', { type: 'image/png' });

    // Drop with reversed file order: child first, then parent, then texture.
    // The root-most pick should still choose parent.tscn because child.tscn is
    // referenced by parent.tscn.
    const input = screen.getByTestId('upload-tscn-input') as HTMLInputElement;
    await act(async () => {
      fireEvent.change(input, {
        target: { files: [childFile, bgTexture, parentFile] },
      });
      await Promise.resolve();
    });

    await waitForScene('ParentRoot');
    expect(screen.getByTestId('uploaded-tscn-label').textContent).toBe('parent.tscn');
    // bg.png is a direct ExtResource of parent.tscn and should be uploaded.
    expect(addUploadedFileSpy).toHaveBeenCalledWith('res://textures/bg.png', bgTexture);
    // child.tscn is an ExtResource of parent — it should also be uploaded as a resource.
    expect(addUploadedFileSpy).toHaveBeenCalledWith('res://scenes/child.tscn', childFile);
  });
});

describe('no-.tscn drop fulfills missing rows', () => {
  it('fulfills a missing row on a texture-only drop (sub-scene dependency arriving later)', async () => {
    const addUploadedFileSpy = vi.spyOn(WebResourceProvider.prototype, 'addUploadedFile');

    // The loaded scene's sub-scene reported this texture missing.
    missingPathsOverride.current = new Set(['res://textures/child_tex.png']);

    render(<R3FApp />);
    await waitForScene();

    const textureFile = new File(['bytes'], 'child_tex.png', { type: 'image/png' });
    await act(async () => {
      dropFiles([textureFile]);
    });

    await waitFor(() => {
      expect(addUploadedFileSpy).toHaveBeenCalledWith('res://textures/child_tex.png', textureFile);
    });
    // Fulfilled, not errored — and the active scene is untouched.
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByText('StubRoot')).toBeTruthy();
  });

  it('surfaces the no-match error when dropping a texture with no missing rows', async () => {
    render(<R3FApp />);
    await waitForScene();

    // Drop a texture with no .tscn and no missing rows yet — should error.
    const textureFile = new File(['bytes'], 'player.png', { type: 'image/png' });
    await act(async () => {
      dropFiles([textureFile]);
    });

    await waitFor(() => {
      expect(screen.queryByRole('alert')).toBeTruthy();
    });
    // The previously-loaded scene must still be showing (hold last valid).
    expect(screen.queryByText('StubRoot')).toBeTruthy();
  });

  it('repeated texture-only drop surfaces no-match error when nothing matches missing list', async () => {
    const addUploadedFileSpy = vi.spyOn(WebResourceProvider.prototype, 'addUploadedFile');

    render(<R3FApp />);
    await waitForScene();

    // First: load a scene with a texture so there are missing rows.
    const sceneFile = new File([SCENE_WITH_TEXTURE], 'with-texture.tscn', { type: 'text/plain' });
    const input = screen.getByTestId('upload-tscn-input') as HTMLInputElement;
    await act(async () => {
      fireEvent.change(input, { target: { files: [sceneFile] } });
      await Promise.resolve();
    });
    await waitForScene('MultiUploadRoot');

    // Now drop an unrelated texture (not player.png) — should error since nothing matches.
    await act(async () => {
      dropFiles([new File(['bytes'], 'unrelated.png', { type: 'image/png' })]);
    });

    await waitFor(() => {
      expect(screen.queryByRole('alert')).toBeTruthy();
    });
    expect(addUploadedFileSpy).not.toHaveBeenCalled();
  });
});
