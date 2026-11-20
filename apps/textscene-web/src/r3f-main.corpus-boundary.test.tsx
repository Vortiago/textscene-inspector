import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';

import { ResourceLoader } from '@textscene/core';
import { R3FApp } from './r3f-main';
import { WebResourceProvider } from './providers/WebResourceProvider';
import { fixtures } from './fixturesAll';
import { buildFixtureTree, type SceneLeaf } from './fixtureTreeModel';
import { flattenLeaves } from './fixtureTreeModel.testkit';

/** A vendored demo fixture, whose corpus root differs from the base ('') one. */
const DEMO = fixtures.find((f) => f.root) as (typeof fixtures)[number];
/** Two base-corpus fixtures (root ''), the second for the same-corpus control. */
const [BASE, BASE_OTHER] = fixtures.filter((f) => !f.root) as [
  (typeof fixtures)[number],
  (typeof fixtures)[number],
];

const leaves = flattenLeaves(buildFixtureTree(fixtures));
const leafFor = (file: string) => leaves.find((l) => l.file === file) as SceneLeaf;

const sceneWithRoot = (name: string) => `[gd_scene load_steps=1 format=3]

[node name="${name}" type="Node3D"]
`;

const ROOT_NAME: Record<string, string> = {
  [DEMO.file]: 'DemoRoot',
  [BASE.file]: 'BaseRoot',
  [BASE_OTHER.file]: 'OtherBaseRoot',
};

/**
 * Scene fetches resolve at once, except `gatedFile`, which hangs until `releaseGate()`: the
 * window where the outgoing scene is on screen and the incoming one has not arrived.
 */
let releaseGate: () => void = () => {};
function mockFetch(gatedFile?: string) {
  const gate = new Promise<void>((resolve) => {
    releaseGate = resolve;
  });

  globalThis.fetch = vi.fn().mockImplementation(async (url: unknown) => {
    const path = String(url).replace(/^.*\/fixtures\//, '');
    const rootName = ROOT_NAME[path];
    if (rootName === undefined) {
      // A resource fetch, which never resolves to anything usable here.
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
    // happy-dom can throw here, and clearing storage is optional.
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
let newLoader: ReturnType<typeof vi.spyOn>;

/** Whether the demo was on screen at the first re-point. `undefined` until then, which fails `toBeNull`. */
let atRootSwitch: HTMLElement | null | undefined;

beforeEach(() => {
  atRootSwitch = undefined;
  const realSetRoot = WebResourceProvider.prototype.setResourceRoot;
  setResourceRoot = vi.spyOn(WebResourceProvider.prototype, 'setResourceRoot').mockImplementation(function (
    this: WebResourceProvider,
    root: string
  ) {
    if (atRootSwitch === undefined) atRootSwitch = screen.queryByText('DemoRoot');
    realSetRoot.call(this, root);
  });
  // Each new pipeline hands its loader the provider once, so this counts new loaders.
  newLoader = vi.spyOn(ResourceLoader.prototype, 'setProvider');
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
    newLoader.mockClear();
    atRootSwitch = undefined;

    await switchViaPalette(BASE.file);

    // The incoming fetch is in flight. r3f unmounts the demo's consumers on its own schedule,
    // outside the teardown's flushSync, so a re-point now would make them re-request their
    // res:// paths under the base corpus. The root waits for the swap.
    expect(setResourceRoot).not.toHaveBeenCalled();
    // And nothing of the demo is left rendering while the base fixture loads.
    await waitFor(() => {
      expect(screen.queryByText('DemoRoot')).toBeNull();
    });

    await act(async () => {
      releaseGate();
      await Promise.resolve();
    });
    await waitForScene('BaseRoot');

    expect(setResourceRoot).toHaveBeenCalledWith('');
    expect(newLoader).toHaveBeenCalled();
    // …and it landed with the demo already gone from the tree.
    expect(atRootSwitch).toBeNull();
  });

  it('crosses into the base corpus on upload with the demo already gone', async () => {
    mockFetch();
    resetPersistence(`/?fixture=${DEMO.file}`);
    render(<R3FApp />);
    await waitForScene('DemoRoot');

    newLoader.mockClear();
    setResourceRoot.mockClear();
    atRootSwitch = undefined;

    const sceneFile = new File([sceneWithRoot('UploadedRoot')], 'uploaded.tscn', {
      type: 'text/plain',
    });
    const input = screen.getByTestId('upload-tscn-input') as HTMLInputElement;
    await act(async () => {
      fireEvent.change(input, { target: { files: [sceneFile] } });
      await Promise.resolve();
    });
    await waitForScene('UploadedRoot');

    // An upload lives in the base ('') corpus, so it gets a loader of its own and the demo went first.
    expect(newLoader).toHaveBeenCalled();
    expect(setResourceRoot).toHaveBeenCalledWith('');
    expect(atRootSwitch).toBeNull();
  });

  it('refetches when the user re-picks a fixture whose load failed', async () => {
    // By state, not by call count: StrictMode fetches twice on mount.
    let isSceneServed = false;
    let sceneFetches = 0;
    globalThis.fetch = vi.fn().mockImplementation(async (url: unknown) => {
      const path = String(url).replace(/^.*\/fixtures\//, '');
      if (path !== BASE.file) return { ok: false, status: 404 } as Response;
      sceneFetches += 1;
      if (!isSceneServed) return { ok: false, statusText: 'Not Found' } as Response;
      return {
        ok: true,
        text: () => Promise.resolve(sceneWithRoot('BaseRoot')),
      } as unknown as Response;
    }) as unknown as typeof fetch;

    resetPersistence(`/?fixture=${BASE.file}`);
    render(<R3FApp />);
    await screen.findByRole('alert');
    expect(screen.queryByText('BaseRoot')).toBeNull();

    isSceneServed = true;
    const fetchesBeforeRepick = sceneFetches;
    await switchViaPalette(BASE.file);

    await waitForScene('BaseRoot');
    expect(sceneFetches - fetchesBeforeRepick).toBe(1);
  });

  it('leaves resolution untouched across a same-corpus switch, holding the old render', async () => {
    mockFetch(BASE_OTHER.file);
    resetPersistence(`/?fixture=${BASE.file}`);
    render(<R3FApp />);
    await waitForScene('BaseRoot');

    setResourceRoot.mockClear();
    newLoader.mockClear();

    await switchViaPalette(BASE_OTHER.file);

    // Only a corpus crossing tears down: a switch within one corpus holds the last valid
    // render until the new content lands.
    expect(screen.queryByText('BaseRoot')).toBeTruthy();

    await act(async () => {
      releaseGate();
      await Promise.resolve();
    });
    await waitForScene('OtherBaseRoot');

    // The same res:// namespace on both sides, so no re-routing, and the loader and its cache stay.
    expect(setResourceRoot).not.toHaveBeenCalledWith(expect.not.stringMatching(/^$/));
    expect(newLoader).not.toHaveBeenCalled();
  });
});
