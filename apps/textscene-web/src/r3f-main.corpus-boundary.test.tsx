/**
 * The corpus boundary is crossed with the viewport empty: nothing re-points resource
 * resolution while a scene from the outgoing corpus is rendered. `useCorpusRoot` describes
 * the leak a breach causes.
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

/** A vendored demo fixture, whose corpus root differs from the base ('') one. */
const DEMO = fixtures.find((f) => f.root) as (typeof fixtures)[number];
/** Two base-corpus fixtures (root ''), the second for the same-corpus control. */
const [BASE, BASE_OTHER] = fixtures.filter((f) => !f.root) as [
  (typeof fixtures)[number],
  (typeof fixtures)[number],
];

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
let clearCaches: ReturnType<typeof vi.spyOn>;

/**
 * Whether the outgoing demo was on screen at the first re-point: each node rendered then
 * fetches under the incoming root. First only, so a harmless later repeat cannot hide it.
 * `value` stays `undefined` until it fires, so `toBeNull()` also fails a missing re-point.
 */
function firstDemoSighting() {
  let value: HTMLElement | null | undefined;
  return {
    record: () => {
      if (value === undefined) value = screen.queryByText('DemoRoot');
    },
    get value() {
      return value;
    },
  };
}

/** At the cache clear, and at the provider re-point (the upload path re-points
 *  synchronously in its own handler, where React defers the clear past the swap). */
let atClear: ReturnType<typeof firstDemoSighting>;
let atRootSwitch: ReturnType<typeof firstDemoSighting>;

function resetFingerprints() {
  atClear = firstDemoSighting();
  atRootSwitch = firstDemoSighting();
}

beforeEach(() => {
  resetFingerprints();
  const realSetRoot = WebResourceProvider.prototype.setResourceRoot;
  setResourceRoot = vi
    .spyOn(WebResourceProvider.prototype, 'setResourceRoot')
    .mockImplementation(function (this: WebResourceProvider, root: string) {
      atRootSwitch.record();
      realSetRoot.call(this, root);
    });
  const realClear = ResourceLoader.prototype.clearCaches;
  clearCaches = vi
    .spyOn(ResourceLoader.prototype, 'clearCaches')
    .mockImplementation(function (this: ResourceLoader) {
      atClear.record();
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

    // The incoming fetch is in flight. r3f unmounts the demo's consumers on its own schedule,
    // outside the teardown's flushSync, so a re-point now would make them re-request their
    // res:// paths under the base corpus. The root waits for the swap.
    expect(setResourceRoot).not.toHaveBeenCalled();
    expect(clearCaches).not.toHaveBeenCalled();
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
    expect(clearCaches).toHaveBeenCalledTimes(1);
    // …and it landed with the demo already gone from the tree.
    expect(atClear.value).toBeNull();
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

    // An upload lives in the base ('') corpus, so this drop crossed a boundary, and the demo
    // was torn down before the clear, as on a fixture switch.
    expect(clearCaches).toHaveBeenCalledTimes(1);
    expect(atClear.value).toBeNull();
    expect(setResourceRoot).toHaveBeenCalledWith('');
    expect(atRootSwitch.value).toBeNull();
  });

  it('refetches when the user re-picks a fixture whose load failed', async () => {
    // The scene fetch fails once, then succeeds. Picking the same entry again is the only
    // retry, and a corpus crossing leaves nothing on screen to fall back to.
    let attempt = 0;
    globalThis.fetch = vi.fn().mockImplementation(async (url: unknown) => {
      const path = String(url).replace(/^.*\/fixtures\//, '');
      if (path !== BASE.file) return { ok: false, status: 404 } as Response;
      attempt += 1;
      if (attempt === 1) return { ok: false, statusText: 'Not Found' } as Response;
      return {
        ok: true,
        text: () => Promise.resolve(sceneWithRoot('BaseRoot')),
      } as unknown as Response;
    }) as unknown as typeof fetch;

    resetPersistence(`/?fixture=${BASE.file}`);
    render(<R3FApp />);
    await screen.findByRole('alert');
    expect(screen.queryByText('BaseRoot')).toBeNull();

    await switchViaPalette(BASE.file);

    await waitForScene('BaseRoot');
    expect(attempt).toBe(2);
  });

  it('leaves resolution untouched across a same-corpus switch, holding the old render', async () => {
    mockFetch(BASE_OTHER.file);
    resetPersistence(`/?fixture=${BASE.file}`);
    render(<R3FApp />);
    await waitForScene('BaseRoot');

    setResourceRoot.mockClear();
    clearCaches.mockClear();

    await switchViaPalette(BASE_OTHER.file);

    // Only a corpus crossing tears down: a switch within one corpus holds the last valid
    // render until the new content lands.
    expect(screen.queryByText('BaseRoot')).toBeTruthy();

    await act(async () => {
      releaseGate();
      await Promise.resolve();
    });
    await waitForScene('OtherBaseRoot');

    // The same res:// namespace on both sides, so no re-routing and no cache clear, whose
    // invalidation burst leaks across corpora.
    expect(setResourceRoot).not.toHaveBeenCalled();
    expect(clearCaches).not.toHaveBeenCalled();
  });
});
