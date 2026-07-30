/**
 * Corpus-scoped uploads — app-shell integration.
 *
 * Exercises the real wiring, not the provider in isolation (that contract
 * lives in WebResourceProvider.corpusScope.test.ts):
 *  - uploading a scene + companion files while a demo corpus is active must
 *    key the companions under the uploaded scene's base ('') corpus, not the
 *    demo root that was active when the upload handler ran;
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
import { buildFixtureTree } from './fixtureTree';
import { flattenLeaves, type Leaf } from './fixtureTree.testkit';

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

describe('Corpus-scoped uploads — app-shell wiring', () => {
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

  /**
   * `res://project.godot` is the SAME path in every corpus — only the active
   * **Corpus root** decides which file it maps onto — so the **Project
   * settings** must be re-read on a switch, not carried over. A scene whose
   * project sets `gui/theme/default_theme_scale` would otherwise scale the
   * next scene's Controls too (or, arriving second, not scale its own).
   */
  it('re-reads project.godot on a corpus switch, so the theme scale follows the scene', async () => {
    const scaled = `[gd_scene load_steps=1 format=3]

[node name="ScaledRoot" type="Control"]

[node name="Caption" type="Label" parent="."]
text = "caption"
`;
    // Only the demo corpus has a project.godot, and it sets scale 2.0.
    globalThis.fetch = vi.fn().mockImplementation((url: unknown) => {
      const href = String(url);
      if (href.endsWith(`/${DEMO.root}/project.godot`)) {
        return Promise.resolve({
          ok: true,
          headers: { get: () => 'text/plain' },
          text: () => Promise.resolve('[gui]\n\ntheme/default_theme_scale=2.0\n'),
        } as unknown as Response);
      }
      if (href.endsWith('/project.godot')) {
        // The base corpus has none — an ordinary outcome, never an error.
        return Promise.resolve({ ok: false } as unknown as Response);
      }
      return Promise.resolve({
        ok: true,
        text: () => Promise.resolve(href.endsWith(`/${DEMO.file}`) ? scaled : STUB_TSCN),
      } as unknown as Response);
    }) as unknown as typeof fetch;

    resetPersistence(`/?fixture=${DEMO.file}`);
    // The Control overlay only mounts in the 2D workspace, and the workspace a
    // scene opens in is persisted state a sibling test can leave behind — pin
    // it so this asserts the theme scale, not whichever mode ran last.
    globalThis.localStorage.setItem('tsi.viewportMode', '2D');
    render(<R3FApp />);
    await waitForScene('ScaledRoot');

    const caption = () =>
      document.querySelector<HTMLElement>('[data-control-type="Label"]');
    // `Canvas2DStage` lazy-imports the Control barrel, so the overlay appears a
    // dynamic-import tick after the scene does — longer than waitFor's default
    // second once the whole suite is competing for the module graph.
    await waitFor(() => expect(caption()).toBeTruthy(), { timeout: 15000 });
    // round(16 * 2.0) = 32 — the demo project's scale reached its Controls.
    await waitFor(() => expect(caption()!.style.fontSize).toBe('32px'), { timeout: 15000 });
  });
});
