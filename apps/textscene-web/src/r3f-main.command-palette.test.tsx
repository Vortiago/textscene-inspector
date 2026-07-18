/**
 * Command-palette (Ctrl/⌘K scene switcher) coverage.
 *
 * `<Toolbar>`'s palette (r3f-main.tsx:640-841) had no dedicated test: other
 * `r3f-main.*.test.tsx` files (deep-link, fixture-fetch, source-edit) open it
 * only as a MEANS to switch fixtures for an unrelated assertion, never
 * pinning the palette's own mechanics — Ctrl/⌘K toggle, Escape, backdrop
 * click, search-focus/reset-on-open, query filtering, and the shared
 * disk-open file input's close-on-pick / value-reset behavior.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';

// `<TscnCanvas>` mounts a real WebGL `<Canvas>` happy-dom can't provide —
// stub it (and the scene contents) so the rest of the shell + toolbar render.
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

const SWITCHED_TSCN = `[gd_scene load_steps=1 format=3]

[node name="SwitchedRoot" type="Node3D"]
`;

const PICKED_TSCN = `[gd_scene load_steps=1 format=3]

[node name="PickedRoot" type="Node3D"]
`;


const DEFAULT_FILE = 'unit-plane-mesh.tscn';
const NON_DEFAULT_LEAVES = flattenLeaves(buildFixtureTree(fixtures)).filter(
  (l) => l.file !== DEFAULT_FILE
);
/** Two leaves far apart in the flattened list — minimizes any accidental label overlap. */
const TARGET_A = NON_DEFAULT_LEAVES[0] as Leaf;
const TARGET_B = NON_DEFAULT_LEAVES[NON_DEFAULT_LEAVES.length - 1] as Leaf;

function mockFetch() {
  globalThis.fetch = vi.fn().mockImplementation((url: unknown) => {
    const text = String(url).endsWith(`/${TARGET_A.file}`) ? SWITCHED_TSCN : STUB_TSCN;
    return Promise.resolve({
      ok: true,
      text: () => Promise.resolve(text),
    } as unknown as Response);
  }) as unknown as typeof fetch;
}

async function waitForScene(rootName = 'StubRoot') {
  await waitFor(() => {
    expect(screen.queryByText(rootName)).toBeTruthy();
  });
}

function openPalette() {
  fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
}

async function findDialog() {
  return screen.findByRole('dialog', { name: 'Open or switch scene' });
}

function queryDialog() {
  return screen.queryByRole('dialog', { name: 'Open or switch scene' });
}

beforeEach(() => {
  try {
    globalThis.localStorage.clear();
  } catch {
    // happy-dom may throw in some edge cases; ignore.
  }
  window.history.replaceState(null, '', '/');
  mockFetch();
});

afterEach(() => {
  vi.restoreAllMocks();
  window.history.replaceState(null, '', '/');
});

describe('command palette — open/close', () => {
  it('opens on Ctrl+K', async () => {
    render(<R3FApp />);
    await waitForScene();

    openPalette();

    expect(await findDialog()).toBeTruthy();
  });

  it('opens on Cmd+K (metaKey)', async () => {
    render(<R3FApp />);
    await waitForScene();

    fireEvent.keyDown(window, { key: 'k', metaKey: true });

    expect(await findDialog()).toBeTruthy();
  });

  it('a second Ctrl+K toggles the palette closed', async () => {
    render(<R3FApp />);
    await waitForScene();
    openPalette();
    await findDialog();

    openPalette();

    await waitFor(() => {
      expect(queryDialog()).toBeNull();
    });
  });

  it('Escape closes the open palette', async () => {
    render(<R3FApp />);
    await waitForScene();
    openPalette();
    await findDialog();

    fireEvent.keyDown(window, { key: 'Escape' });

    await waitFor(() => {
      expect(queryDialog()).toBeNull();
    });
  });

  it('clicking the backdrop closes the palette', async () => {
    render(<R3FApp />);
    await waitForScene();
    openPalette();
    const dialog = await findDialog();
    const backdrop = dialog.previousElementSibling as HTMLElement;

    fireEvent.click(backdrop);

    await waitFor(() => {
      expect(queryDialog()).toBeNull();
    });
  });
});

describe('command palette — search focus and query reset', () => {
  it('auto-focuses the search field once the palette opens', async () => {
    render(<R3FApp />);
    await waitForScene();

    openPalette();
    const search = await screen.findByLabelText('Filter built-in scenes');

    await waitFor(() => {
      expect(document.activeElement).toBe(search);
    });
  });

  it('resets the query text each time the palette is reopened', async () => {
    render(<R3FApp />);
    await waitForScene();
    openPalette();
    const search = (await screen.findByLabelText('Filter built-in scenes')) as HTMLInputElement;
    fireEvent.change(search, { target: { value: 'leftover query' } });
    expect(search.value).toBe('leftover query');

    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => expect(queryDialog()).toBeNull());

    openPalette();
    const reopenedSearch = (await screen.findByLabelText(
      'Filter built-in scenes'
    )) as HTMLInputElement;

    expect(reopenedSearch.value).toBe('');
  });
});

describe('command palette — filtering and scene selection', () => {
  it('filters the list to only scenes matching the query', async () => {
    render(<R3FApp />);
    await waitForScene();
    openPalette();
    const dialog = await findDialog();

    fireEvent.change(within(dialog).getByLabelText('Filter built-in scenes'), {
      target: { value: TARGET_A.label },
    });

    expect(within(dialog).getByText(TARGET_A.label)).toBeTruthy();
    expect(within(dialog).queryByText(TARGET_B.label)).toBeNull();
  });

  it('selecting a filtered scene switches to it and closes the palette', async () => {
    render(<R3FApp />);
    await waitForScene();
    openPalette();
    const dialog = await findDialog();
    fireEvent.change(within(dialog).getByLabelText('Filter built-in scenes'), {
      target: { value: TARGET_A.label },
    });

    fireEvent.click(within(dialog).getByText(TARGET_A.label));

    await waitForScene('SwitchedRoot');
    expect(queryDialog()).toBeNull();
  });
});

describe('command palette — open a .tscn from disk', () => {
  it('delegates the "Open a .tscn from disk…" click to the shared hidden file input', async () => {
    render(<R3FApp />);
    await waitForScene();
    openPalette();
    const dialog = await findDialog();
    const clickSpy = vi.spyOn(HTMLInputElement.prototype, 'click');

    fireEvent.click(within(dialog).getByRole('button', { name: /open a/i }));

    expect(clickSpy).toHaveBeenCalled();
  });

  it('closes the palette once a file is picked via the shared input', async () => {
    render(<R3FApp />);
    await waitForScene();
    openPalette();
    await findDialog();
    const input = screen.getByTestId('upload-tscn-input') as HTMLInputElement;
    const file = new File([PICKED_TSCN], 'picked.tscn', { type: 'text/plain' });

    await act(async () => {
      fireEvent.change(input, { target: { files: [file] } });
      await Promise.resolve();
    });

    await waitFor(() => expect(queryDialog()).toBeNull());
    await waitFor(() => expect(screen.queryByText('PickedRoot')).toBeTruthy());
  });

  it('resets the shared input value after a pick, so the same filename can be re-selected', async () => {
    render(<R3FApp />);
    await waitForScene();
    const input = screen.getByTestId('upload-tscn-input') as HTMLInputElement;
    const file = new File([PICKED_TSCN], 'picked.tscn', { type: 'text/plain' });

    await act(async () => {
      fireEvent.change(input, { target: { files: [file] } });
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(input.value).toBe('');
    });
  });
});
