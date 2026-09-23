/**
 * The source pane's toggle, splitter, persistence and display, through `<R3FApp>`. The DOM
 * handles are `data-testid="source-pane"` (absent when hidden), `source-pane-toggle` and
 * `source-pane-splitter`, around a monospace <textarea>. The pane wraps <TscnPreviewShell>
 * (ADR-0007, ADR-0020), and its toggle rides the shell's `toolbar` slot inside the <header>.
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

const FIXTURE_KEY = 'tscn-web-r3f-fixture';
const SOURCE_PANE_KEY = 'tscn-web-source-pane';

const STUB_TSCN = `[gd_scene load_steps=1 format=3]

[node name="StubRoot" type="Node3D"]
`;

const UPLOADED_TSCN = `[gd_scene load_steps=1 format=3]

[node name="UploadedRoot" type="Node3D"]
`;

/** Wipe the whole store, so each test starts from first-load defaults whatever keys the
 * pane persists under. */
function resetPersistence() {
  try {
    globalThis.localStorage.clear();
    globalThis.localStorage.removeItem(FIXTURE_KEY);
  } catch {
    // happy-dom can throw here, and clearing storage is optional.
  }
}

/** Default-fixture fetch on mount returns a stable, valid scene so the shell settles. */
function mockFetch(text = STUB_TSCN) {
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: true,
    text: () => Promise.resolve(text),
  } as unknown as Response) as unknown as typeof fetch;
}

/** Wait until the shell has parsed the loaded scene (its root shows in the tree). */
async function waitForScene(rootName = 'StubRoot') {
  await waitFor(() => {
    expect(screen.queryByText(rootName)).toBeTruthy();
  });
}

/** The pane's source <textarea>. */
function paneTextarea() {
  return within(screen.getByTestId('source-pane')).getByRole('textbox') as HTMLTextAreaElement;
}

/** Whether a textarea is monospace in a way happy-dom shows: inline or computed font-family,
 * or a class name with "mono". happy-dom applies no CSS-module cascade. */
function isMonospace(ta: HTMLTextAreaElement) {
  const inline = ta.getAttribute('style') ?? '';
  const computed = (globalThis.getComputedStyle?.(ta)?.fontFamily ?? '');
  return /mono/i.test(inline) || /mono/i.test(computed) || /mono/i.test(ta.className);
}

/** Drag the splitter to a new absolute x (px). It dispatches to the splitter, the document and
 * window, so the test holds whichever one the handler listens on. */
function dragSplitterTo(clientX: number) {
  const splitter = screen.getByTestId('source-pane-splitter');
  fireEvent.mouseDown(splitter, { clientX: 600 });
  act(() => {
    fireEvent.mouseMove(splitter, { clientX });
    document.dispatchEvent(new MouseEvent('mousemove', { clientX, bubbles: true }));
    window.dispatchEvent(new MouseEvent('mousemove', { clientX, bubbles: true }));
  });
  act(() => {
    fireEvent.mouseUp(splitter, { clientX });
    document.dispatchEvent(new MouseEvent('mouseup', { clientX, bubbles: true }));
    window.dispatchEvent(new MouseEvent('mouseup', { clientX, bubbles: true }));
  });
}

const paneWidth = () => parseFloat(screen.getByTestId('source-pane').style.width || 'NaN');

beforeEach(() => {
  resetPersistence();
  mockFetch();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('#200 source pane — display of the loaded .tscn (criteria 1 + 6)', () => {
  it('renders the pane showing the loaded scene source in an editable monospace textarea', async () => {
    render(<R3FApp />);
    await waitForScene();

    const pane = screen.getByTestId('source-pane');
    expect(pane).toBeTruthy();

    const ta = paneTextarea();
    // The pane shows the same source text that feeds the shell.
    expect(ta.value).toContain('StubRoot');
    // The pane is editable, and the buffer drives the render.
    expect(ta.readOnly).toBe(false);
    // Forced monospace.
    expect(isMonospace(ta)).toBe(true);
    // Code-editor feel: long lines scroll horizontally, they do NOT word-wrap.
    expect(ta.getAttribute('wrap')).toBe('off');
    // The source field is labelled for assistive tech.
    expect(ta.getAttribute('aria-label')).toBe('Scene source');
  });

  it('sits to the LEFT of the viewport (pane precedes the shell in document order)', async () => {
    render(<R3FApp />);
    await waitForScene();

    const pane = screen.getByTestId('source-pane');
    // The shell renders a <header> ("TextScene Inspector"); the pane must come before it.
    const shellHeader = document.querySelector('header');
    expect(shellHeader).toBeTruthy();
    const DOCUMENT_POSITION_FOLLOWING = 4; // pane's position relative to header
    expect(pane.compareDocumentPosition(shellHeader as Node) & DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('updates the pane text when a new scene is uploaded', async () => {
    render(<R3FApp />);
    await waitForScene();
    expect(paneTextarea().value).toContain('StubRoot');

    const uploadInput = screen.getByTestId('upload-tscn-input') as HTMLInputElement;
    const file = new File([UPLOADED_TSCN], 'my-scene.tscn', { type: 'text/plain' });
    await act(async () => {
      fireEvent.change(uploadInput, { target: { files: [file] } });
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(paneTextarea().value).toContain('UploadedRoot');
    });
    expect(paneTextarea().value).not.toContain('StubRoot');
  });
});

describe('#200 source pane — toggle in the toolbar slot (criterion 2)', () => {
  it('renders the toggle inside the shell top bar (rides the existing toolbar slot)', async () => {
    render(<R3FApp />);
    await waitForScene();

    const toggle = screen.getByTestId('source-pane-toggle');
    // The web app reaches the shell's <header> only through its `toolbar` prop, so the toggle
    // rides that slot without a shell API change (ADR-0020).
    expect(toggle.closest('header')).toBeTruthy();
  });

  it('hides the pane on toggle and shows it again on a second toggle', async () => {
    render(<R3FApp />);
    await waitForScene();
    const toggle = screen.getByTestId('source-pane-toggle');
    expect(screen.queryByTestId('source-pane')).toBeTruthy();
    // The toggle reports its disclosure state to assistive tech.
    expect(toggle.getAttribute('aria-expanded')).toBe('true');

    fireEvent.click(toggle);
    await waitFor(() => {
      expect(screen.queryByTestId('source-pane')).toBeNull();
    });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');

    fireEvent.click(toggle);
    await waitFor(() => {
      expect(screen.queryByTestId('source-pane')).toBeTruthy();
    });
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
  });
});

describe('#200 source pane — shown by default on first load (criterion 3)', () => {
  it('shows the pane with no prior state and no interaction', async () => {
    render(<R3FApp />);
    await waitForScene();
    expect(screen.getByTestId('source-pane')).toBeTruthy();
  });
});

describe('#200 source pane — draggable splitter resizes the pane (criterion 4)', () => {
  it('narrows the pane when the splitter is dragged left', async () => {
    render(<R3FApp />);
    await waitForScene();

    const before = paneWidth();
    expect(Number.isFinite(before)).toBe(true); // an inline style sets the width, so it is observable and resizable

    dragSplitterTo(300); // drag left from 600 → the left pane must shrink
    await waitFor(() => {
      expect(paneWidth()).toBeLessThan(before);
    });
  });
});

describe('#200 source pane — state persists across reloads (criterion 5)', () => {
  it('remembers the hidden state across a remount', async () => {
    const first = render(<R3FApp />);
    await waitForScene();
    fireEvent.click(screen.getByTestId('source-pane-toggle')); // hide
    await waitFor(() => expect(screen.queryByTestId('source-pane')).toBeNull());
    first.unmount();

    render(<R3FApp />); // "reload"
    await waitForScene();
    // With no interaction, the persisted choice keeps the pane hidden.
    expect(screen.queryByTestId('source-pane')).toBeNull();
  });

  it('remembers the pane width across a remount', async () => {
    const first = render(<R3FApp />);
    await waitForScene();
    dragSplitterTo(320);
    await waitFor(() => expect(paneWidth()).toBeLessThan(600));
    const persisted = paneWidth();
    first.unmount();

    render(<R3FApp />); // "reload"
    await waitForScene();
    expect(Math.abs(paneWidth() - persisted)).toBeLessThan(1);
  });

  it('falls back to the shown-at-320 default when the persisted blob is corrupt', async () => {
    globalThis.localStorage.setItem(SOURCE_PANE_KEY, 'not-json{{');
    render(<R3FApp />);
    await waitForScene();
    // A garbage blob must not hide the pane or zero its width.
    expect(screen.getByTestId('source-pane')).toBeTruthy();
    expect(paneWidth()).toBe(320);
  });

  it('fills only the missing field of a partial blob (visible kept, width defaulted)', async () => {
    globalThis.localStorage.setItem(SOURCE_PANE_KEY, JSON.stringify({ visible: true }));
    render(<R3FApp />);
    await waitForScene();
    expect(screen.getByTestId('source-pane')).toBeTruthy();
    expect(paneWidth()).toBe(320);
  });

  it('rejects a non-positive persisted width and falls back to 320', async () => {
    globalThis.localStorage.setItem(SOURCE_PANE_KEY, JSON.stringify({ visible: true, width: 0 }));
    render(<R3FApp />);
    await waitForScene();
    // width:0 would collapse the pane, so it falls back instead.
    expect(paneWidth()).toBe(320);
  });
});

describe('#200 source pane — splitter clamps the width to [180, 800] (criterion 4 bounds)', () => {
  it('floors the width at 180 when dragged far past the left bound', async () => {
    render(<R3FApp />);
    await waitForScene();
    // From the 320 default, mousedown is at x=600, so x=100 means dx=-500 → 320-500=-180.
    dragSplitterTo(100);
    await waitFor(() => expect(paneWidth()).toBe(180));
  });

  it('caps the width at 800 when dragged far past the right bound', async () => {
    render(<R3FApp />);
    await waitForScene();
    // dx = 2000-600 = +1400 → 320+1400 = 1720, clamped to the 800 max.
    dragSplitterTo(2000);
    await waitFor(() => expect(paneWidth()).toBe(800));
  });
});
