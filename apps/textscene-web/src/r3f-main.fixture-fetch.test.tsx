/**
 * Fixture-fetch failure + debounce-supersession pins for the editable source pane.
 *
 * Pins the app-level state table around `fetch(/fixtures/…)`:
 *   - a fetch that FAILS clears the pane buffer, HOLDS the previous render, and
 *     surfaces the load-error banner (role="alert");
 *   - a pending edit forward (the pane's debounce) is superseded by a fixture
 *     switch — the switched root renders and the edited root never does, whether
 *     the switch's fetch succeeds or fails;
 *   - a stale error banner is cleared by the interaction that supersedes it
 *     (fetch error → upload; upload error → fixture switch).
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';

// <TscnCanvas> mounts a real WebGL <Canvas> happy-dom can't provide — stub it (and the
// scene contents) so the rest of the shell + the pane render. Everything else is real.
vi.mock('@textscene/core', async () => {
  const real = await vi.importActual<typeof import('@textscene/core')>('@textscene/core');
  return { ...real, TscnCanvas: () => null, TscnSceneContents: () => null };
});

import { R3FApp } from './r3f-main';
import { fixtures } from './fixturesAll';
import { buildFixtureTree, type TreeBranch } from './fixtureTree';

const STUB_TSCN = `[gd_scene load_steps=1 format=3]

[node name="StubRoot" type="Node3D"]
`;

const EDITED_TSCN = `[gd_scene load_steps=1 format=3]

[node name="EditedRoot" type="Node3D"]
`;

const SWITCHED_TSCN = `[gd_scene load_steps=1 format=3]

[node name="SwitchedRoot" type="Node3D"]
`;

/** The fixture the tests switch TO (any leaf that isn't the app's default). */
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
const DEFAULT_FILE = 'unit-plane-mesh.tscn';
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

/** Open the palette and click the switch target. The events are synchronous, so an
 * armed debounce timer (250 ms) cannot fire between a preceding edit and the switch. */
async function switchToTarget() {
  fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
  const palette = await screen.findByRole('dialog', { name: 'Open or switch scene' });
  fireEvent.change(within(palette).getByLabelText('Filter built-in scenes'), {
    target: { value: SWITCH_TARGET.label },
  });
  fireEvent.click(within(palette).getByText(SWITCH_TARGET.label));
}

/** Let real time pass with React kept happy about the debounce timer's state flush. */
async function settle(ms: number) {
  await act(async () => {
    await new Promise((r) => setTimeout(r, ms));
  });
}

beforeEach(() => {
  try {
    globalThis.localStorage.clear();
  } catch {
    // happy-dom may throw in edge cases; ignore.
  }
  // #221: a fixture switch now writes `?fixture=` back to the URL
  // (history.replaceState) — reset it so one test's switch doesn't leak
  // into the next test's initial mount as a stale deep link.
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
    // The pane buffer is cleared…
    expect(paneTextarea().value).toBe('');
    // …but the previous render HOLDS (forwarded content untouched on failure).
    expect(screen.queryByText('StubRoot')).toBeTruthy();
  });
});

describe('debounce supersession — a fixture switch cancels a pending edit forward', () => {
  it('renders the switched root, never the edited one, when the switch fetch succeeds', async () => {
    mockFetch('ok');
    render(<R3FApp />);
    await waitForScene();

    fireEvent.change(paneTextarea(), { target: { value: EDITED_TSCN } }); // arms the debounce
    await switchToTarget(); // well inside the debounce window

    await waitForScene('SwitchedRoot');
    await settle(600); // past any debounce — the abandoned edit must never surface
    expect(screen.queryByText('EditedRoot')).toBeNull();
    expect(paneTextarea().value).toBe(SWITCHED_TSCN);
  });

  it('holds the pre-edit render, never the edited one, when the switch fetch fails', async () => {
    mockFetch('fail');
    render(<R3FApp />);
    await waitForScene();

    fireEvent.change(paneTextarea(), { target: { value: EDITED_TSCN } });
    await switchToTarget();

    await waitFor(() => {
      expect(screen.queryByRole('alert')?.textContent).toContain('Failed to load fixture');
    });
    await settle(600);
    expect(screen.queryByText('EditedRoot')).toBeNull();
    expect(paneTextarea().value).toBe('');
    expect(screen.queryByText('StubRoot')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Error-banner supersession — newer interactions clear stale errors
// ---------------------------------------------------------------------------

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
});
