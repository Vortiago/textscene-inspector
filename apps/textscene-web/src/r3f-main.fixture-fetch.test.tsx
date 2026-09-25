/**
 * The app state around `fetch(/fixtures/…)`: a failed fetch clears the buffer, holds the
 * render and shows the load-error banner. A fixture switch supersedes a pending edit forward.
 * The interaction that supersedes an error clears its banner, and the most recent error shows.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';

// happy-dom cannot provide the WebGL <Canvas> that <TscnCanvas> mounts, so it and the scene
// contents are stubs. Everything else is real.
vi.mock('@textscene/core', async () => {
  const real = await vi.importActual<typeof import('@textscene/core')>('@textscene/core');
  return { ...real, TscnCanvas: () => null, TscnSceneContents: () => null };
});

import { R3FApp } from './r3f-main';
import { fixtures } from './fixturesAll';
import { buildFixtureTree } from './fixtureTree';
import { flattenLeaves, type Leaf } from './fixtureTree.testkit';
import { DEBOUNCE_MS } from './useSceneSource';

const STUB_TSCN = `[gd_scene load_steps=1 format=3]

[node name="StubRoot" type="Node3D"]
`;

const EDITED_TSCN = `[gd_scene load_steps=1 format=3]

[node name="EditedRoot" type="Node3D"]
`;

const SWITCHED_TSCN = `[gd_scene load_steps=1 format=3]

[node name="SwitchedRoot" type="Node3D"]
`;

const DEFAULT_FILE = 'unit-plane-mesh.tscn';
/** The fixture the tests switch to: any leaf but the app's default. */
const SWITCH_TARGET = flattenLeaves(buildFixtureTree(fixtures)).find(
  (l) => l.file !== DEFAULT_FILE
) as Leaf;

/** Default fixture resolves with the stub; the switch target succeeds or fails per test. */
function mockFetch(target: 'ok' | 'fail') {
  globalThis.fetch = vi.fn().mockImplementation((url: unknown) => {
    if (String(url).endsWith(`/${SWITCH_TARGET.file}`)) {
      return target === 'ok'
        ? Promise.resolve({
            ok: true,
            text: () => Promise.resolve(SWITCHED_TSCN),
          } as unknown as Response)
        : Promise.resolve({ ok: false, statusText: 'Not Found' } as unknown as Response);
    }
    return Promise.resolve({
      ok: true,
      text: () => Promise.resolve(STUB_TSCN),
    } as unknown as Response);
  }) as unknown as typeof fetch;
}

/** Wait until the shell has parsed a scene (its root shows in the tree). */
async function waitForScene(rootName = 'StubRoot') {
  await waitFor(
    () => {
      expect(screen.queryByText(rootName)).toBeTruthy();
    },
    { timeout: 3000 }
  );
}

/** The pane's source <textarea>. */
function paneTextarea() {
  return within(screen.getByTestId('source-pane')).getByRole('textbox') as HTMLTextAreaElement;
}

/**
 * Open the palette and click the switch target. `justBeforeClick` runs in the click's
 * synchronous task, so the pane's DEBOUNCE_MS edit forward it arms cannot fire before the
 * switch lands. Armed before this call, it would race the palette lookup and flake under load.
 */
async function switchToTarget(justBeforeClick?: () => void) {
  fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
  const palette = await screen.findByRole('dialog', { name: 'Open or switch scene' });
  fireEvent.change(within(palette).getByLabelText('Filter built-in scenes'), {
    target: { value: SWITCH_TARGET.label },
  });
  justBeforeClick?.();
  fireEvent.click(within(palette).getByText(SWITCH_TARGET.label));
}

/**
 * Outlast the pane's debounce inside `act`. This timer is armed after any edit debounce
 * timer, so timer order makes a surviving edit forward fire first under any load. The 2x
 * is margin, not load compensation.
 */
async function settlePastDebounce() {
  await act(async () => {
    await new Promise((r) => setTimeout(r, DEBOUNCE_MS * 2));
  });
}

beforeEach(() => {
  try {
    globalThis.localStorage.clear();
  } catch {
    // happy-dom can throw here, and clearing storage is optional.
  }
  // A fixture switch writes `?fixture=` to the URL, which would reach the next test's mount
  // as a stale deep link.
  window.history.replaceState(null, '', '/');
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('fixture fetch failure — pane clears, render holds, banner shows', () => {
  it('shows the load-error banner and holds the previous render when a switch fetch fails', async () => {
    mockFetch('fail');
    render(<R3FApp />);
    await waitForScene();

    await switchToTarget();

    await waitFor(() => {
      expect(screen.queryByRole('alert')?.textContent).toContain('Failed to load fixture');
    });
    // The pane buffer is cleared,
    expect(paneTextarea().value).toBe('');
    // but the previous render holds.
    expect(screen.queryByText('StubRoot')).toBeTruthy();
  });
});

describe('debounce supersession — a fixture switch cancels a pending edit forward', () => {
  // An edit mid-switch triggers the discard guard, and happy-dom has no window.confirm.
  // r3f-main.edit-guard.test.tsx holds the guard's own contract.
  beforeEach(() => {
    vi.stubGlobal('confirm', vi.fn(() => true));
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders the switched root, never the edited one, when the switch fetch succeeds', async () => {
    mockFetch('ok');
    render(<R3FApp />);
    await waitForScene();

    await switchToTarget(() => {
      // Armed in the click's task, so inside the window.
      fireEvent.change(paneTextarea(), { target: { value: EDITED_TSCN } });
    });

    await waitForScene('SwitchedRoot');
    await settlePastDebounce(); // the abandoned edit must never surface
    expect(screen.queryByText('EditedRoot')).toBeNull();
    expect(paneTextarea().value).toBe(SWITCHED_TSCN);
  });

  it('holds the pre-edit render, never the edited one, when the switch fetch fails', async () => {
    mockFetch('fail');
    render(<R3FApp />);
    await waitForScene();

    await switchToTarget(() => {
      // Armed in the click's task, so inside the window.
      fireEvent.change(paneTextarea(), { target: { value: EDITED_TSCN } });
    });

    await waitFor(() => {
      expect(screen.queryByRole('alert')?.textContent).toContain('Failed to load fixture');
    });
    await settlePastDebounce();
    expect(screen.queryByText('EditedRoot')).toBeNull();
    expect(paneTextarea().value).toBe('');
    expect(screen.queryByText('StubRoot')).toBeTruthy();
  });
});

// Error-banner supersession: a newer interaction clears a stale error.

const UPLOADED_TSCN = `[gd_scene load_steps=1 format=3]

[node name="UploadedRoot" type="Node3D"]
`;

/** Drop files on the app root (React only reads `.files` off dataTransfer). */
function dropFiles(files: File[]) {
  fireEvent.drop(screen.getByTestId('app-root'), {
    dataTransfer: { files, types: ['Files'] },
  });
}

describe('error-banner supersession — stale errors do not outlive the next action', () => {
  it('clears the load-error banner when a valid .tscn is uploaded afterwards', async () => {
    mockFetch('fail');
    render(<R3FApp />);
    await waitForScene();

    await switchToTarget();
    await waitFor(() => {
      expect(screen.queryByRole('alert')?.textContent).toContain('Failed to load fixture');
    });

    dropFiles([new File([UPLOADED_TSCN], 'uploaded.tscn', { type: 'text/plain' })]);

    await waitForScene('UploadedRoot');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('clears the "no .tscn" upload error when the user switches to a fixture', async () => {
    mockFetch('ok');
    render(<R3FApp />);
    await waitForScene();

    dropFiles([new File(['not a scene'], 'texture.png', { type: 'image/png' })]);
    await waitFor(() => {
      expect(screen.queryByRole('alert')?.textContent).toContain('No .tscn file found');
    });

    await switchToTarget();

    await waitForScene('SwitchedRoot');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('shows the fixture error, not the stale upload error, when the switch fetch fails after a bad drop', async () => {
    // The switch target's fetch stays in flight until the test fails it, so an upload error
    // lands before the fetch error. The banner shows the most recent one, the fetch error.
    let failSwitchFetch!: () => void;
    globalThis.fetch = vi.fn().mockImplementation((url: unknown) => {
      if (String(url).endsWith(`/${SWITCH_TARGET.file}`)) {
        return new Promise<Response>((resolve) => {
          failSwitchFetch = () =>
            resolve({ ok: false, statusText: 'Not Found' } as unknown as Response);
        });
      }
      return Promise.resolve({
        ok: true,
        text: () => Promise.resolve(STUB_TSCN),
      } as unknown as Response);
    }) as unknown as typeof fetch;

    render(<R3FApp />);
    await waitForScene();

    await switchToTarget();
    dropFiles([new File(['not a scene'], 'texture.png', { type: 'image/png' })]);
    await waitFor(() => {
      expect(screen.queryByRole('alert')?.textContent).toContain('No .tscn file found');
    });

    await act(async () => {
      failSwitchFetch();
    });

    await waitFor(() => {
      expect(screen.queryByRole('alert')?.textContent).toContain('Failed to load fixture');
    });
  });
});
