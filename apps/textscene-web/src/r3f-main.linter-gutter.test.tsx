/**
 * Issue #202 — Source pane slice 3: linter surfaced (gutter dots + hover
 * popover + toggle problem-count badge).
 *
 * RED contract. Behavioral `<R3FApp>` tests reusing the `r3f-main.*.test.tsx`
 * WebGL-mock pattern (happy-dom has no WebGL; `TscnCanvas`/`TscnSceneContents`
 * stubbed, everything else real). The known-bad fixture below omits every
 * node identifier (`type=`/`index=`/`instance=`) on line 3 — a strict-parser
 * structural check (`StrictTscnParser`) that fires unconditionally,
 * regardless of which per-node-type validators/rules happen to be
 * registered, so the test doesn't depend on the linter's node-type coverage.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';

vi.mock('@textscene/core', async () => {
  const real = await vi.importActual<typeof import('@textscene/core')>('@textscene/core');
  return { ...real, TscnCanvas: () => null, TscnSceneContents: () => null };
});

import { R3FApp } from './r3f-main';

const STUB_TSCN = `[gd_scene load_steps=1 format=3]

[node name="StubRoot" type="Node3D"]
`;

// Line 3 (1-indexed) is missing a type=/index=/instance= attribute — a
// deterministic strict-parser error regardless of registered node rules.
const BAD_LINE_TSCN = `[gd_scene load_steps=1 format=3]

[node name="Root"]
`;
const BAD_LINE = 3;
const EXPECTED_MESSAGE = 'Node heading must have "type=", "index=", or "instance=" attribute';

const CLEAN_TSCN = `[gd_scene load_steps=1 format=3]

[node name="CleanRoot" type="Node3D"]
`;

function mockFetch(text = STUB_TSCN) {
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: true,
    text: () => Promise.resolve(text),
  } as unknown as Response) as unknown as typeof fetch;
}

async function waitForScene(rootName = 'StubRoot') {
  await waitFor(() => {
    expect(screen.queryByText(rootName)).toBeTruthy();
  });
}

function paneTextarea() {
  return within(screen.getByTestId('source-pane')).getByRole('textbox') as HTMLTextAreaElement;
}

function typeBuffer(text: string) {
  fireEvent.change(paneTextarea(), { target: { value: text } });
}

function resetPersistence() {
  try {
    globalThis.localStorage.clear();
  } catch {
    // happy-dom may throw in edge cases; ignore.
  }
}

beforeEach(() => {
  resetPersistence();
  mockFetch();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('#202 linter gutter — dot appears on the offending line (debounced)', () => {
  it('shows no gutter dot for a clean scene', async () => {
    render(<R3FApp />);
    await waitForScene();
    expect(screen.queryByTestId(`gutter-dot-${BAD_LINE}`)).toBeNull();
  });

  it('shows an error-severity gutter dot on the bad line after editing, debounced', async () => {
    render(<R3FApp />);
    await waitForScene();

    typeBuffer(BAD_LINE_TSCN);
    // Debounced: not synchronous with the keystroke.
    expect(screen.queryByTestId(`gutter-dot-${BAD_LINE}`)).toBeNull();

    await waitFor(() => {
      expect(screen.queryByTestId(`gutter-dot-${BAD_LINE}`)).toBeTruthy();
    });
    const dot = screen.getByTestId(`gutter-dot-${BAD_LINE}`);
    expect(dot.className).toMatch(/error/i);
  });

  it('clears the gutter dot once the line is fixed', async () => {
    render(<R3FApp />);
    await waitForScene();

    typeBuffer(BAD_LINE_TSCN);
    await waitFor(() => {
      expect(screen.queryByTestId(`gutter-dot-${BAD_LINE}`)).toBeTruthy();
    });

    typeBuffer(CLEAN_TSCN);
    await waitFor(() => {
      expect(screen.queryByTestId(`gutter-dot-${BAD_LINE}`)).toBeNull();
    });
  });
});

describe('#202 linter gutter — hover popover shows the line message(s)', () => {
  it('shows the diagnostic message on hover/focus and hides it again on leave/blur', async () => {
    render(<R3FApp />);
    await waitForScene();

    typeBuffer(BAD_LINE_TSCN);
    await waitFor(() => {
      expect(screen.queryByTestId(`gutter-dot-${BAD_LINE}`)).toBeTruthy();
    });

    expect(screen.queryByText(EXPECTED_MESSAGE)).toBeNull();

    const dot = screen.getByTestId(`gutter-dot-${BAD_LINE}`);
    fireEvent.mouseEnter(dot);
    expect(screen.getByText(EXPECTED_MESSAGE)).toBeTruthy();

    fireEvent.mouseLeave(dot);
    expect(screen.queryByText(EXPECTED_MESSAGE)).toBeNull();
  });
});

describe('#202 linter gutter — toggle carries a problem-count badge', () => {
  it('shows no badge for a clean scene', async () => {
    render(<R3FApp />);
    await waitForScene();
    const toggle = screen.getByTestId('source-pane-toggle');
    expect(within(toggle).queryByTestId('problem-badge')).toBeNull();
  });

  it('shows the error count once the buffer has a bad line', async () => {
    render(<R3FApp />);
    await waitForScene();

    typeBuffer(BAD_LINE_TSCN);
    await waitFor(() => {
      const toggle = screen.getByTestId('source-pane-toggle');
      expect(within(toggle).queryByTestId('problem-badge')).toBeTruthy();
    });
    const toggle = screen.getByTestId('source-pane-toggle');
    expect(within(toggle).getByTestId('problem-badge').textContent).toContain('1');
  });

  it('keeps the badge visible when the pane is collapsed', async () => {
    render(<R3FApp />);
    await waitForScene();

    typeBuffer(BAD_LINE_TSCN);
    await waitFor(() => {
      const toggle = screen.getByTestId('source-pane-toggle');
      expect(within(toggle).queryByTestId('problem-badge')).toBeTruthy();
    });

    fireEvent.click(screen.getByTestId('source-pane-toggle'));
    await waitFor(() => expect(screen.queryByTestId('source-pane')).toBeNull());

    const toggle = screen.getByTestId('source-pane-toggle');
    expect(within(toggle).queryByTestId('problem-badge')).toBeTruthy();
  });
});
