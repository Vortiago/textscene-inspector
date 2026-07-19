/**
 * The corpus boundary is crossed with the viewport EMPTY.
 *
 * Regression for the cross-corpus resource leak: the corpus root used to be
 * derived from the SELECTED fixture, so it flipped the moment the user picked a
 * scene — while the previous corpus's scene was still mounted and the new
 * .tscn was still being fetched. `loader.clearCaches()` announces every dropped
 * path, a mounted `useResource` consumer answers by re-requesting, and those
 * re-requests resolved under the INCOMING corpus root: loading a base fixture
 * after a vendored demo fetched the demo's res:// paths out of `/fixtures/`,
 * downloading an unrelated fixture's files (a real collision: the demo's
 * `res://tileset/tileset.tres` resolved onto dungeon.tscn's tileset).
 *
 * The invariant these lock down: nothing re-points resource resolution while a
 * scene from the outgoing corpus is still the rendered content.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';

vi.mock('@textscene/core', async () => {
  const real = await vi.importActual<typeof import('@textscene/core')>('@textscene/core');
  return { ...real, TscnCanvas: () => null, TscnSceneContents: () => null };
});

import { ResourceLoader } from '@textscene/core';
import { R3FApp } from './r3f-main';
import { WebResourceProvider } from './providers/WebResourceProvider';
import { fixtures } from './fixturesAll';
import { buildFixtureTree } from './fixtureTree';
import { flattenLeaves, type Leaf } from './fixtureTree.testkit';

/** A vendored demo fixture — its corpus root differs from the base ('') one. */
const DEMO = fixtures.find((f) => f.root) as (typeof fixtures)[number];
/** A base-corpus fixture — root ''. */
const BASE = fixtures.find((f) => !f.root) as (typeof fixtures)[number];
/** A second base-corpus fixture, for the same-corpus control. */
const BASE_OTHER = fixtures.filter((f) => !f.root)[1] as (typeof fixtures)[number];

const leaves = flattenLeaves(buildFixtureTree(fixtures));
const leafFor = (file: string) => leaves.find((l) => l.file === file) as Leaf;

const sceneWithRoot = (name: string) => `[gd_scene load_steps=1 format=3]

[node name="${name}" type="Node3D"]
`;

const ROOT_NAME: Record<string, string> = {
  [DEMO.file]: 'DemoRoot',
  [BASE.file]: 'BaseRoot',
  [BASE_OTHER.file]: 'OtherBaseRoot',
};

/**
 * Scene fetches resolve immediately, EXCEPT for `gatedFile`, whose fetch hangs
 * until `releaseGate()` — the window in which the outgoing scene is still on
 * screen and the incoming one has not arrived.
 */
let releaseGate: () => void;
function mockFetch(gatedFile?: string) {
  let openGate: (() => void) | null = null;
  const gate = new Promise<void>((resolve) => (openGate = resolve));
  releaseGate = () => openGate?.();

  globalThis.fetch = vi.fn().mockImplementation(async (url: unknown) => {
    const path = String(url).replace(/^.*\/fixtures\//, '');
    const rootName = ROOT_NAME[path];
    if (rootName === undefined) {
      // A resource fetch — never resolves to anything usable here.
      return { ok: false, status: 404 } as Response;
    }
    if (gatedFile && path === gatedFile) await gate;
    return {
      ok: true,
      text: () => Promise.resolve(sceneWithRoot(rootName)),
    } as unknown as Response;
  }) as unknown as typeof fetch;
}

function resetPersistence(path = '/') {
  try {
    globalThis.localStorage.clear();
  } catch {
    // happy-dom may throw in edge cases; ignore.
  }
  window.history.replaceState(null, '', path);
}

async function waitForScene(rootName: string) {
  await waitFor(() => {
    expect(screen.queryByText(rootName)).toBeTruthy();
  });
}

/** Pick a scene through the command palette. */
async function switchViaPalette(file: string) {
  const leaf = leafFor(file);
  fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
  const palette = await screen.findByRole('dialog', { name: 'Open or switch scene' });
  fireEvent.change(within(palette).getByLabelText('Filter built-in scenes'), {
    target: { value: leaf.label },
  });
  await act(async () => {
    fireEvent.click(within(palette).getByText(leaf.label));
    await Promise.resolve();
  });
}

let setResourceRoot: ReturnType<typeof vi.spyOn>;
let clearCaches: ReturnType<typeof vi.spyOn>;
/**
 * What the scene tree showed at the instant the caches were cleared — the
 * leak's fingerprint, since every node still rendered then is a consumer that
 * answers the invalidation with a fetch under the incoming corpus root.
 */
let outgoingSceneAtClear: HTMLElement | null | 'never-cleared';
/**
 * The same fingerprint for the routing half. The upload path re-points the
 * provider synchronously inside its own handler, so this — not the cache
 * clear, which React defers past the content swap — is what catches a root
 * moving out from under a live scene there.
 */
let outgoingSceneAtRootSwitch: HTMLElement | null | 'never-switched';

/**
 * Both fingerprints record the FIRST occurrence after a reset: a leak is a
 * scene alive at the first re-point, and a later, harmless repeat once the
 * swap has settled must not paper over it.
 */
function resetFingerprints() {
  outgoingSceneAtClear = 'never-cleared';
  outgoingSceneAtRootSwitch = 'never-switched';
}

beforeEach(() => {
  resetFingerprints();
  const realSetRoot = WebResourceProvider.prototype.setResourceRoot;
  setResourceRoot = vi
    .spyOn(WebResourceProvider.prototype, 'setResourceRoot')
    .mockImplementation(function (this: WebResourceProvider, root: string) {
      if (outgoingSceneAtRootSwitch === 'never-switched') {
        outgoingSceneAtRootSwitch = screen.queryByText('DemoRoot');
      }
      realSetRoot.call(this, root);
    });
  const realClear = ResourceLoader.prototype.clearCaches;
  clearCaches = vi
    .spyOn(ResourceLoader.prototype, 'clearCaches')
    .mockImplementation(function (this: ResourceLoader) {
      if (outgoingSceneAtClear === 'never-cleared') {
        outgoingSceneAtClear = screen.queryByText('DemoRoot');
      }
      realClear.call(this);
    });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('corpus boundary — the root never moves under a mounted scene', () => {
  it('holds the demo corpus root for the whole fetch of an incoming base fixture', async () => {
    mockFetch(BASE.file);
    resetPersistence(`/?fixture=${DEMO.file}`);
    render(<R3FApp />);
    await waitForScene('DemoRoot');

    setResourceRoot.mockClear();
    clearCaches.mockClear();
    resetFingerprints();

    await switchViaPalette(BASE.file);

    // The incoming fixture's fetch is still in flight. Re-pointing resolution
    // now is exactly the leak: the demo's consumers would answer the cache
    // clear by re-requesting their res:// paths under the base corpus.
    expect(setResourceRoot).not.toHaveBeenCalled();
    expect(clearCaches).not.toHaveBeenCalled();

    await act(async () => {
      releaseGate();
      await Promise.resolve();
    });
    await waitForScene('BaseRoot');

    expect(setResourceRoot).toHaveBeenCalledWith('');
    expect(clearCaches).toHaveBeenCalledTimes(1);
    // …and it landed with the demo already gone from the tree.
    expect(outgoingSceneAtClear).toBeNull();
  });

  it('crosses into the base corpus on upload with the demo already gone', async () => {
    mockFetch();
    resetPersistence(`/?fixture=${DEMO.file}`);
    render(<R3FApp />);
    await waitForScene('DemoRoot');

    clearCaches.mockClear();
    setResourceRoot.mockClear();
    resetFingerprints();

    const sceneFile = new File([sceneWithRoot('UploadedRoot')], 'uploaded.tscn', {
      type: 'text/plain',
    });
    const input = screen.getByTestId('upload-tscn-input') as HTMLInputElement;
    await act(async () => {
      fireEvent.change(input, { target: { files: [sceneFile] } });
      await Promise.resolve();
    });
    await waitForScene('UploadedRoot');

    // An uploaded scene lives in the base ('') corpus, so this drop crossed a
    // boundary — and the demo's scene was torn down before the clear, exactly
    // as on a fixture switch.
    expect(clearCaches).toHaveBeenCalledTimes(1);
    expect(outgoingSceneAtClear).toBeNull();
    expect(setResourceRoot).toHaveBeenCalledWith('');
    expect(outgoingSceneAtRootSwitch).toBeNull();
  });

  it('tears the outgoing scene down before the boundary is crossed', async () => {
    mockFetch(BASE.file);
    resetPersistence(`/?fixture=${DEMO.file}`);
    render(<R3FApp />);
    await waitForScene('DemoRoot');

    await switchViaPalette(BASE.file);

    // Nothing of the demo is left rendering while the base fixture loads, so
    // no consumer of the demo's corpus survives to observe the switch.
    await waitFor(() => {
      expect(screen.queryByText('DemoRoot')).toBeNull();
    });
  });

  it('leaves resolution untouched across a same-corpus switch', async () => {
    mockFetch();
    resetPersistence(`/?fixture=${BASE.file}`);
    render(<R3FApp />);
    await waitForScene('BaseRoot');

    setResourceRoot.mockClear();
    clearCaches.mockClear();

    await switchViaPalette(BASE_OTHER.file);
    await waitForScene('OtherBaseRoot');

    // Same res:// namespace on both sides — no re-routing, and above all no
    // cache clear, whose invalidation burst is what leaks across corpora.
    expect(setResourceRoot).not.toHaveBeenCalled();
    expect(clearCaches).not.toHaveBeenCalled();
  });

  it('keeps the outgoing scene on screen across a same-corpus switch', async () => {
    mockFetch(BASE_OTHER.file);
    resetPersistence(`/?fixture=${BASE.file}`);
    render(<R3FApp />);
    await waitForScene('BaseRoot');

    await switchViaPalette(BASE_OTHER.file);

    // The teardown is the corpus-boundary price only — a switch within one
    // corpus still holds the last valid render until the new content lands.
    expect(screen.queryByText('BaseRoot')).toBeTruthy();

    await act(async () => {
      releaseGate();
      await Promise.resolve();
    });
    await waitForScene('OtherBaseRoot');
  });
});
