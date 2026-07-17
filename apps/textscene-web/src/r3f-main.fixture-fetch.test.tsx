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
 *     (fetch error → upload; upload error → fixture switch), and when both
 *     channels hold an error the most recently SET one shows.
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
/** The fixture the tests switch TO (any leaf that isn't the app's default). */
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
 * Open the palette and click the switch target. `justBeforeClick` (if given)
 * runs in the same synchronous task as the click itself, so anything it arms —
 * specifically the pane's DEBOUNCE_MS edit forward — cannot fire before the
 * switch lands. Arming the edit BEFORE this call would race the real debounce
 * timer against the awaited palette lookup and flake under machine load.
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
 * Deterministically outlast the pane's debounce, keeping React happy about
 * the timer's state flush. This sleep timer is armed strictly AFTER any edit
 * debounce timer, so timer-expiry ordering guarantees a (wrongly) surviving
 * edit forward fires before this resolves — regardless of machine load. The
 * 2x is pure margin, not load compensation.
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
    // happy-dom may throw in edge cases; ignore.
  }
  // A fixture switch writes `?fixture=` back to the URL
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
  // These scenarios edit the pane mid-switch, which now triggers the
  // edit-discard guard — accept it (happy-dom has no window.confirm); the
  // guard's own contract lives in r3f-main.edit-guard.test.tsx.
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
      // Armed in the same task as the click — guaranteed inside the window.
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
      // Armed in the same task as the click — guaranteed inside the window.
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

  it('shows the fixture error, not the stale upload error, when the switch fetch fails after a bad drop', async () => {
    // The switch target's fetch stays in flight until the test fails it,
    // opening the window where an upload error lands BEFORE the fetch error.
    // The banner must then show the fetch error — the most recently set one.
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
