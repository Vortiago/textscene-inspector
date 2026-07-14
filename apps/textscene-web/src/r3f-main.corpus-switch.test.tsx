/**
 * Corpus-scoped uploads — app-shell integration (issue #264).
 *
 * Exercises the real wiring, not the provider in isolation (that contract
 * lives in WebResourceProvider.corpusScope.test.ts):
 *  - uploading a scene + companion files while a demo corpus is active must
 *    key the companions under the uploaded scene's base ('') corpus, not the
 *    demo root that was still active when the upload handler ran (the
 *    useCorpusRoot effect only lands after re-render);
 *  - switching from an uploaded scene to a demo fixture through the scene
 *    palette must stop serving the uploaded-scene corpus's files.
 * Reuses the `r3f-main.*.test.tsx` WebGL-mock pattern.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';

vi.mock('@textscene/core', async () => {
  const real = await vi.importActual<typeof import('@textscene/core')>('@textscene/core');
  return { ...real, TscnCanvas: () => null, TscnSceneContents: () => null };
});

import { R3FApp } from './r3f-main';
import { WebResourceProvider } from './providers/WebResourceProvider';
import { fixtures } from './fixturesAll';
import { buildFixtureTree, type TreeBranch } from './fixtureTree';

const STUB_TSCN = `[gd_scene load_steps=1 format=3]

[node name="StubRoot" type="Node3D"]
`;

const DEMO_TSCN = `[gd_scene load_steps=1 format=3]

[node name="DemoRoot" type="Node3D"]
`;

const SCENE_WITH_TEXTURE = `[gd_scene load_steps=2 format=3]

[ext_resource type="Texture2D" path="res://textures/player.png" id="1_abc"]

[node name="MultiUploadRoot" type="Node3D"]
`;

/** A vendored demo fixture — its corpus root differs from the base ('') one. */
const DEMO = fixtures.find((f) => f.root) as (typeof fixtures)[number];

type Leaf = { file: string; label: string };
function flattenLeaves(branches: readonly TreeBranch[]): Leaf[] {
  const out: Leaf[] = [];
  const walk = (b: TreeBranch) => {
    for (const child of b.children) {
      if (child.kind === 'branch') walk(child);
      else out.push({ file: child.file, label: child.label });
    }
  };
  branches.forEach(walk);
  return out;
}
const DEMO_LEAF = flattenLeaves(buildFixtureTree(fixtures)).find(
  (l) => l.file === DEMO.file
) as Leaf;

function resetPersistence(path = '/') {
  try {
    globalThis.localStorage.clear();
  } catch {
    // happy-dom may throw in edge cases; ignore.
  }
  window.history.replaceState(null, '', path);
}

/** Scene fetches succeed; resource fetches lack headers and so fall through
 *  to "Resource not found" — loadResource only resolves via an upload. */
function mockFetch() {
  globalThis.fetch = vi.fn().mockImplementation((url: unknown) => {
    const text = String(url).endsWith(`/${DEMO.file}`) ? DEMO_TSCN : STUB_TSCN;
    return Promise.resolve({
      ok: true,
      text: () => Promise.resolve(text),
    } as unknown as Response);
  }) as unknown as typeof fetch;
}

async function waitForScene(rootName: string) {
  await waitFor(() => {
    expect(screen.queryByText(rootName)).toBeTruthy();
  });
}

async function uploadSceneWithTexture(): Promise<WebResourceProvider> {
  const addSpy = vi.spyOn(WebResourceProvider.prototype, 'addUploadedFile');
  const sceneFile = new File([SCENE_WITH_TEXTURE], 'multi-scene.tscn', { type: 'text/plain' });
  const textureFile = new File(['fake-png-bytes'], 'player.png', { type: 'image/png' });
  const input = screen.getByTestId('upload-tscn-input') as HTMLInputElement;

  await act(async () => {
    fireEvent.change(input, { target: { files: [sceneFile, textureFile] } });
    await Promise.resolve();
  });

  await waitForScene('MultiUploadRoot');
  expect(addSpy).toHaveBeenCalledWith('res://textures/player.png', textureFile);
  return addSpy.mock.contexts[0] as WebResourceProvider;
}

beforeEach(() => {
  mockFetch();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('#264 corpus-scoped uploads — app-shell wiring', () => {
  it('keys companion uploads under the uploaded scene corpus even when a demo corpus was active', async () => {
    // Deep-link straight into a vendored demo so the provider's active root
    // is a demo corpus when the multi-file upload arrives.
    resetPersistence(`/?fixture=${DEMO.file}`);
    render(<R3FApp />);
    await waitForScene('DemoRoot');

    const provider = await uploadSceneWithTexture();

    // The uploaded scene lives in the base ('') corpus; its companion file
    // must be visible there, not stranded under the demo root.
    await expect(
      provider.loadResource('res://textures/player.png', 'Texture2D')
    ).resolves.toBeInstanceOf(ArrayBuffer);
  });

  it('switching to a demo fixture stops serving the uploaded scene corpus upload', async () => {
    resetPersistence();
    render(<R3FApp />);
    await waitForScene('StubRoot');

    const provider = await uploadSceneWithTexture();
    await expect(
      provider.loadResource('res://textures/player.png', 'Texture2D')
    ).resolves.toBeInstanceOf(ArrayBuffer);

    // Switch to a vendored demo through the scene palette.
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    const palette = await screen.findByRole('dialog', { name: 'Open or switch scene' });
    fireEvent.change(within(palette).getByLabelText('Filter built-in scenes'), {
      target: { value: DEMO_LEAF.label },
    });
    fireEvent.click(within(palette).getByText(DEMO_LEAF.label));
    await waitForScene('DemoRoot');

    // The base-corpus upload must not bleed into the demo corpus.
    await expect(
      provider.loadResource('res://textures/player.png', 'Texture2D')
    ).rejects.toThrow('Resource not found');
  });
});
