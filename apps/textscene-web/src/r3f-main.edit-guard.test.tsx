/**
 * Discard guard for Source-pane edits: edits are ephemeral (ADR-0020), but
 * loss must not be SILENT — every one-click scene replacement (fixture
 * palette, the tree's ⤢ open-sub-scene which routes through the same
 * handler, and a scene-replacing drop/upload) confirms before discarding
 * keystrokes newer than the last load. Unedited panes never prompt, and a
 * resource-only drop (no .tscn) never prompts — it fulfills missing rows
 * without touching the buffer.
 *
 * Reuses the r3f-main.*.test.tsx WebGL-mock pattern: TscnCanvas /
 * TscnSceneContents stubbed (happy-dom has no WebGL), everything else real.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';

vi.mock('@textscene/core', async () => {
  const real = await vi.importActual<typeof import('@textscene/core')>('@textscene/core');
  return { ...real, TscnCanvas: () => null, TscnSceneContents: () => null };
});

import { R3FApp } from './r3f-main';
import { fixtures } from './fixturesAll';
import { buildFixtureTree } from './fixtureTree';
import { flattenLeaves, type Leaf } from './fixtureTree.testkit';

const STUB_TSCN = `[gd_scene load_steps=1 format=3]

[node name="StubRoot" type="Node3D"]
`;

const EDITED_TSCN = `[gd_scene load_steps=1 format=3]

[node name="EditedRoot" type="Node3D"]
`;

const UPLOADED_TSCN = `[gd_scene load_steps=1 format=3]

[node name="UploadedRoot" type="Node3D"]
`;

const SWITCHED_TSCN = `[gd_scene load_steps=1 format=3]

[node name="SwitchedRoot" type="Node3D"]
`;

const DEFAULT_FILE = 'unit-plane-mesh.tscn';
const SWITCH_TARGET = flattenLeaves(buildFixtureTree(fixtures)).find(
  (l) => l.file !== DEFAULT_FILE
) as Leaf;

function resetPersistence() {
  try {
    globalThis.localStorage.clear();
  } catch {
    // happy-dom may throw in edge cases; ignore.
  }
  window.history.replaceState(null, '', '/');
}

function mockFetch() {
  globalThis.fetch = vi.fn().mockImplementation((url: unknown) => {
    const text = String(url).endsWith(`/${SWITCH_TARGET.file}`) ? SWITCHED_TSCN : STUB_TSCN;
    return Promise.resolve({
      ok: true,
      text: () => Promise.resolve(text),
    } as unknown as Response);
  }) as unknown as typeof fetch;
}

async function waitForScene(rootName = 'StubRoot') {
  await waitFor(
    () => {
      expect(screen.queryByText(rootName)).toBeTruthy();
    },
    { timeout: 3000 }
  );
}

function paneTextarea() {
  return within(screen.getByTestId('source-pane')).getByRole('textbox') as HTMLTextAreaElement;
}

function typeBuffer(text: string) {
  fireEvent.change(paneTextarea(), { target: { value: text } });
}

/** Switch fixture via the palette (Ctrl+K → filter → click leaf). */
async function switchViaPalette() {
  fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
  const palette = await screen.findByRole('dialog', { name: 'Open or switch scene' });
  fireEvent.change(within(palette).getByLabelText('Filter built-in scenes'), {
    target: { value: SWITCH_TARGET.label },
  });
  fireEvent.click(within(palette).getByText(SWITCH_TARGET.label));
}

async function uploadScene() {
  const uploadInput = screen.getByTestId('upload-tscn-input') as HTMLInputElement;
  const file = new File([UPLOADED_TSCN], 'my-scene.tscn', { type: 'text/plain' });
  await act(async () => {
    fireEvent.change(uploadInput, { target: { files: [file] } });
    await Promise.resolve();
  });
}

/**
 * happy-dom does not implement window.confirm — stub the global (returning
 * `accept`) and hand back the mock for call assertions.
 */
function stubConfirm(accept: boolean) {
  const fn = vi.fn(() => accept);
  vi.stubGlobal('confirm', fn);
  return fn;
}

beforeEach(() => {
  resetPersistence();
  mockFetch();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  resetPersistence();
});

describe('Source-pane edit-discard guard', () => {
  it('switching fixture with an unedited pane never prompts', async () => {
    const confirmSpy = stubConfirm(true);
    render(<R3FApp />);
    await waitForScene();

    await switchViaPalette();
    await waitForScene('SwitchedRoot');

    expect(confirmSpy).not.toHaveBeenCalled();
  });

  it('switching fixture after editing prompts; declining keeps the edited buffer and scene', async () => {
    const confirmSpy = stubConfirm(false);
    render(<R3FApp />);
    await waitForScene();

    typeBuffer(EDITED_TSCN);
    await switchViaPalette();

    expect(confirmSpy).toHaveBeenCalledTimes(1);
    // Declined: buffer untouched, no switch (the switched root never shows).
    expect(paneTextarea().value).toBe(EDITED_TSCN);
    expect(screen.queryByText('SwitchedRoot')).toBeNull();
  });

  it('accepting the prompt proceeds with the switch and resets the buffer', async () => {
    stubConfirm(true);
    render(<R3FApp />);
    await waitForScene();

    typeBuffer(EDITED_TSCN);
    await switchViaPalette();

    await waitFor(() => {
      expect(paneTextarea().value).toBe(SWITCHED_TSCN);
    });
    await waitForScene('SwitchedRoot');
  });

  it('a scene-replacing upload after editing prompts; declining aborts the upload', async () => {
    const confirmSpy = stubConfirm(false);
    render(<R3FApp />);
    await waitForScene();

    typeBuffer(EDITED_TSCN);
    await uploadScene();

    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(paneTextarea().value).toBe(EDITED_TSCN);
    expect(screen.queryByText('UploadedRoot')).toBeNull();
  });

  it('an upload replacing an UNEDITED pane never prompts, and a later switch after the upload does not prompt either', async () => {
    const confirmSpy = stubConfirm(true);
    render(<R3FApp />);
    await waitForScene();

    await uploadScene();
    await waitForScene('UploadedRoot');
    expect(confirmSpy).not.toHaveBeenCalled();

    // replace() resets the edited flag — pristine uploaded content must not
    // count as "edits" on the next switch.
    await switchViaPalette();
    await waitForScene('SwitchedRoot');
    expect(confirmSpy).not.toHaveBeenCalled();
  });

  it('re-selecting the CURRENT fixture never prompts — accepting would discard nothing', async () => {
    const confirmSpy = stubConfirm(true);
    render(<R3FApp />);
    await waitForScene();

    typeBuffer(EDITED_TSCN);
    // Pick the fixture that is already active (the palette does not exclude it).
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    const palette = await screen.findByRole('dialog', { name: 'Open or switch scene' });
    const currentLeaf = flattenLeaves(buildFixtureTree(fixtures)).find(
      (l) => l.file === DEFAULT_FILE
    ) as Leaf;
    fireEvent.change(within(palette).getByLabelText('Filter built-in scenes'), {
      target: { value: currentLeaf.label },
    });
    fireEvent.click(within(palette).getByText(currentLeaf.label));

    expect(confirmSpy).not.toHaveBeenCalled();
    expect(paneTextarea().value).toBe(EDITED_TSCN);
  });

  it('a resource-only drop never prompts even with an edited pane', async () => {
    const confirmSpy = stubConfirm(true);
    render(<R3FApp />);
    await waitForScene();

    typeBuffer(EDITED_TSCN);
    const png = new File(['bytes'], 'texture.png', { type: 'image/png' });
    await act(async () => {
      fireEvent.drop(screen.getByTestId('app-root'), {
        dataTransfer: { files: [png], types: ['Files'] },
      });
    });

    expect(confirmSpy).not.toHaveBeenCalled();
    expect(paneTextarea().value).toBe(EDITED_TSCN);
  });
});
