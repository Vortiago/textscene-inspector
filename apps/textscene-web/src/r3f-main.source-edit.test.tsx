/**
 * Source pane slice 2: editable buffer drives the render (hold-last-valid gate).
 *
 * RED contract. Behavioral `<R3FApp>` tests reusing the `r3f-main.*.test.tsx` WebGL-mock
 * pattern (happy-dom has no WebGL; `TscnCanvas`/`TscnSceneContents` stubbed, everything else
 * real — the scene TREE panel is real DOM, so "the viewport updated" is asserted as "the new
 * root node's name appears in the tree").
 *
 * Each `describe` maps to one acceptance criterion of the issue (ADR-0020 §2/§3/§5):
 *   1. editing the pane updates the scene tree via the shell's `content` — after the
 *      debounce, never synchronously on the keystroke;
 *   2. a transiently broken buffer HOLDS the last valid render (the pane keeps the broken
 *      text — the buffer, not the shell, is the source of truth);
 *   3. the forward gate is the LENIENT parser — renders-but-lints-imperfectly still updates;
 *   4. native undo: the pane is editable and the app does not swallow the Ctrl+Z chord
 *      (undo itself is browser-native — unobservable under happy-dom);
 *   5. switching fixture (palette) or uploading resets the buffer to the new file's content.
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

/** Renders under the lenient parser, but a strict pass would complain (unknown property). */
const LINTY_TSCN = `[gd_scene load_steps=1 format=3]

[node name="LintyRoot" type="Node3D"]
definitely_not_a_godot_property = 42
`;

const UPLOADED_TSCN = `[gd_scene load_steps=1 format=3]

[node name="UploadedRoot" type="Node3D"]
`;

const SWITCHED_TSCN = `[gd_scene load_steps=1 format=3]

[node name="SwitchedRoot" type="Node3D"]
`;

const GARBAGE = 'mid-edit garbage, not a scene }{ ]] [[';

/** The fixture the palette test switches TO (any leaf that isn't the app's default). */
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

function resetPersistence() {
  try {
    globalThis.localStorage.clear();
  } catch {
    // happy-dom may throw in edge cases; ignore.
  }
  // #221: a fixture switch now writes `?fixture=` back to the URL
  // (history.replaceState) — reset it so one test's switch doesn't leak
  // into the next test's initial mount as a stale deep link.
  window.history.replaceState(null, '', '/');
}

/** Fixture fetches return the stub scene; the palette's switch target returns its own root. */
function mockFetch() {
  globalThis.fetch = vi.fn().mockImplementation((url: unknown) => {
    const text = String(url).endsWith(`/${SWITCH_TARGET.file}`) ? SWITCHED_TSCN : STUB_TSCN;
    return Promise.resolve({
      ok: true,
      text: () => Promise.resolve(text),
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

/** Type a whole buffer into the pane (single change event — the gate debounce is what matters). */
function typeBuffer(text: string) {
  fireEvent.change(paneTextarea(), { target: { value: text } });
}

/** Let real time pass with React kept happy about the debounce timer's state flush. */
async function settle(ms: number) {
  await act(async () => {
    await new Promise((r) => setTimeout(r, ms));
  });
}

beforeEach(() => {
  resetPersistence();
  mockFetch();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('#201 editable buffer — editing updates the render after the debounce (criterion 1)', () => {
  it('the pane is editable (not read-only) and typing lands in the pane text', async () => {
    render(<R3FApp />);
    await waitForScene();

    const ta = paneTextarea();
    expect(ta.readOnly).toBe(false);

    typeBuffer(EDITED_TSCN);
    expect(paneTextarea().value).toBe(EDITED_TSCN);
  });

  it('a valid edit reaches the scene tree — debounced, never on the keystroke itself', async () => {
    render(<R3FApp />);
    await waitForScene();

    typeBuffer(EDITED_TSCN);
    // Debounce pin: the forward must NOT happen synchronously with the change event
    // (ADR-0020 rejected passing every keystroke straight through).
    expect(screen.queryByText('EditedRoot')).toBeNull();

    await waitForScene('EditedRoot');
    expect(screen.queryByText('StubRoot')).toBeNull();
  });
});

describe('#201 hold-last-valid — a broken buffer keeps the previous render (criterion 2)', () => {
  it('holds the last valid tree through empty and garbage buffers, then recovers', async () => {
    render(<R3FApp />);
    await waitForScene();

    // Mid-edit wipe: empty buffer → the tree must keep showing the last valid scene.
    typeBuffer('');
    await settle(600); // well past any ~250 ms debounce — the hold must be steady-state
    expect(screen.queryByText('StubRoot')).toBeTruthy();

    // Garbage: pane keeps the typed text (buffer is the source of truth), tree keeps the scene.
    typeBuffer(GARBAGE);
    await settle(600);
    expect(paneTextarea().value).toBe(GARBAGE);
    expect(screen.queryByText('StubRoot')).toBeTruthy();

    // Recovery: the next clean edit drives the render again.
    typeBuffer(EDITED_TSCN);
    await waitForScene('EditedRoot');
  });
});

describe('#201 lenient gate — renders-but-lints-imperfectly still updates (criterion 3)', () => {
  it('forwards a buffer the lenient parser renders even though a strict pass would flag it', async () => {
    render(<R3FApp />);
    await waitForScene();

    typeBuffer(LINTY_TSCN);
    await waitForScene('LintyRoot');
  });
});

describe('#201 native undo — the app must not swallow Ctrl+Z in the pane (criterion 4)', () => {
  it('leaves the Ctrl+Z chord to the browser (no preventDefault) on an editable pane', async () => {
    render(<R3FApp />);
    await waitForScene();

    const ta = paneTextarea();
    expect(ta.readOnly).toBe(false); // undo can only exist on an editable textarea

    // fireEvent returns false when a handler called preventDefault — the chord must
    // reach the browser's native undo stack untouched.
    const notSwallowed = fireEvent.keyDown(ta, { key: 'z', ctrlKey: true });
    expect(notSwallowed).toBe(true);
  });
});

describe('#201 buffer reset — switching fixture / uploading replaces the buffer (criterion 5)', () => {
  it('uploading a .tscn resets an edited buffer to the uploaded content', async () => {
    render(<R3FApp />);
    await waitForScene();

    typeBuffer(GARBAGE);
    expect(paneTextarea().value).toBe(GARBAGE);

    const uploadInput = screen.getByTestId('upload-tscn-input') as HTMLInputElement;
    const file = new File([UPLOADED_TSCN], 'my-scene.tscn', { type: 'text/plain' });
    await act(async () => {
      fireEvent.change(uploadInput, { target: { files: [file] } });
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(paneTextarea().value).toBe(UPLOADED_TSCN);
    });
    await waitForScene('UploadedRoot');
  });

  it('switching scenes via the palette resets an edited buffer to the new fixture', async () => {
    render(<R3FApp />);
    await waitForScene();

    typeBuffer(GARBAGE);
    expect(paneTextarea().value).toBe(GARBAGE);

    // Open the switcher palette (Ctrl+K), narrow to the target, click its leaf.
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    const palette = await screen.findByRole('dialog', { name: 'Open or switch scene' });
    fireEvent.change(within(palette).getByLabelText('Filter built-in scenes'), {
      target: { value: SWITCH_TARGET.label },
    });
    fireEvent.click(within(palette).getByText(SWITCH_TARGET.label));

    await waitFor(() => {
      expect(paneTextarea().value).toBe(SWITCHED_TSCN);
    });
    await waitForScene('SwitchedRoot');
  });
});
