/**
 * The badge counts what the Source pane shows: a located finding in the gutter, and one with
 * no line in the file-level section. The linter is scripted, since every finding the real one
 * reports names a line.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { Diagnostic } from '@textscene/core/linter';

vi.mock('@textscene/core', async () => {
  const real = await vi.importActual<typeof import('@textscene/core')>('@textscene/core');
  return { ...real, TscnCanvas: () => null, TscnSceneContents: () => null };
});

/** The findings the scripted linter reports for a buffer; any other buffer lints clean. */
const scripted = vi.hoisted(() => new Map<string, Diagnostic[]>());

vi.mock('@textscene/core/linter', async () => {
  const real = await vi.importActual<typeof import('@textscene/core/linter')>('@textscene/core/linter');
  class Linter {
    lint(content: string): Diagnostic[] {
      return scripted.get(content) ?? [];
    }
  }
  return { ...real, Linter };
});

import { R3FApp } from './r3f-main';
import { mockFetchOk } from './useSceneSource.testkit';

const STUB_TSCN = `[gd_scene format=3]

[node name="StubRoot" type="Node3D"]
`;

const MIXED_TSCN = `[gd_scene format=3]

[node name="Root" type="Node3D"]

[node name="Child" type="Node3D" parent="."]
`;

const LOCATED_ONLY_TSCN = `[gd_scene format=3]

[node name="Only" type="Node3D"]
`;

function finding(severity: Diagnostic['severity'], message: string, line?: number): Diagnostic {
  return {
    severity,
    message,
    nodeName: 'Root',
    nodeType: 'Node3D',
    ruleName: 'scripted',
    ...(line === undefined ? {} : { location: { line, column: 1 } }),
  };
}

scripted.set(MIXED_TSCN, [
  finding('error', 'error on line 3', 3),
  finding('warning', 'warning on line 5', 5),
  finding('info', 'info on line 5', 5),
  finding('warning', 'about the whole file'),
  finding('info', 'also about the whole file'),
]);
scripted.set(LOCATED_ONLY_TSCN, [finding('warning', 'warning on line 3', 3)]);

async function openStubScene() {
  render(<R3FApp />);
  await waitFor(() => expect(screen.queryByText('StubRoot')).toBeTruthy());
}

function typeBuffer(text: string) {
  const pane = screen.getByTestId('source-pane');
  fireEvent.change(within(pane).getByRole('textbox'), { target: { value: text } });
}

function badge() {
  return within(screen.getByTestId('source-pane-toggle')).queryByTestId('problem-badge');
}

/** The sum of the badge's per-severity counts, such as 5 for "✖ 1 / ⚠ 2 / ℹ 2". */
function badgeTotal(): number {
  return (badge()?.textContent?.match(/\d+/g) ?? []).map(Number).reduce((a, b) => a + b, 0);
}

/** Every message a user can open in the gutter, one hover per dot. */
function gutterMessages(): string[] {
  return screen.queryAllByTestId(/^gutter-dot-\d+$/).flatMap((dot) => {
    fireEvent.mouseEnter(dot);
    const line = dot.getAttribute('data-testid')!.replace('gutter-dot-', '');
    const messages = [...screen.getByTestId(`gutter-popover-${line}`).children].map((m) => m.textContent ?? '');
    fireEvent.mouseLeave(dot);
    return messages;
  });
}

/** Every message the file-level section opens on focus, or none when it is absent. */
function fileLevelMessages(): string[] {
  const section = screen.queryByTestId('file-problems');
  if (!section) return [];
  fireEvent.focus(section);
  const messages = [...screen.getByTestId('file-problems-popover').children].map((m) => m.textContent ?? '');
  fireEvent.blur(section);
  return messages;
}

beforeEach(() => {
  try {
    globalThis.localStorage.clear();
  } catch {
    // happy-dom can throw here, and clearing storage is optional.
  }
  globalThis.fetch = mockFetchOk(STUB_TSCN);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('the problem badge and the Source pane', () => {
  it('count the same findings: every one the badge counts opens from the gutter or the file-level section', async () => {
    await openStubScene();
    typeBuffer(MIXED_TSCN);
    await waitFor(() => expect(badge()).toBeTruthy());

    const reachable = gutterMessages().concat(fileLevelMessages());

    expect(badge()!.textContent).toBe('✖ 1 / ⚠ 2 / ℹ 2');
    expect(reachable).toHaveLength(badgeTotal());
    expect(reachable.sort()).toEqual(
      scripted.get(MIXED_TSCN)!.map((d) => d.message).sort()
    );
  });

  it('show a located finding in the gutter on its own line, and not in the file-level section', async () => {
    await openStubScene();
    typeBuffer(MIXED_TSCN);
    await waitFor(() => expect(screen.queryByTestId('gutter-dot-3')).toBeTruthy());

    expect(screen.getByTestId('gutter-dot-3').className).toMatch(/error/i);
    expect(fileLevelMessages()).not.toContain('error on line 3');
  });

  it('show a finding with no line in the file-level section, and mark no gutter row for it', async () => {
    await openStubScene();
    typeBuffer(MIXED_TSCN);
    await waitFor(() => expect(screen.queryByTestId('file-problems')).toBeTruthy());

    expect(fileLevelMessages()).toEqual(['about the whole file', 'also about the whole file']);
    expect(screen.queryByTestId('gutter-dot-1')).toBeNull();
    expect(screen.queryAllByTestId(/^gutter-dot-\d+$/)).toHaveLength(2);
  });

  it('show no file-level section while every finding names a line', async () => {
    await openStubScene();
    typeBuffer(LOCATED_ONLY_TSCN);
    await waitFor(() => expect(screen.queryByTestId('gutter-dot-3')).toBeTruthy());

    expect(screen.queryByTestId('file-problems')).toBeNull();
    expect(badgeTotal()).toBe(1);
  });

  it('show neither a gutter dot nor a file-level section, and no badge, for a clean scene', async () => {
    await openStubScene();
    typeBuffer(MIXED_TSCN);
    await waitFor(() => expect(screen.queryByTestId('file-problems')).toBeTruthy());

    typeBuffer(STUB_TSCN);
    await waitFor(() => expect(badge()).toBeNull());
    expect(screen.queryAllByTestId(/^gutter-dot-\d+$/)).toEqual([]);
    expect(screen.queryByTestId('file-problems')).toBeNull();
  });

  it('show neither for an empty buffer', async () => {
    await openStubScene();
    typeBuffer(MIXED_TSCN);
    await waitFor(() => expect(badge()).toBeTruthy());

    typeBuffer('');
    await waitFor(() => expect(badge()).toBeNull());
    expect(screen.queryAllByTestId(/^gutter-dot-\d+$/)).toEqual([]);
    expect(screen.queryByTestId('file-problems')).toBeNull();
  });
});
