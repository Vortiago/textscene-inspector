/**
 * Shareable deep links: `?fixture=` was read once at mount but
 * never written back, so switching scenes and reloading (or sharing the
 * URL) reopened whatever was last persisted in localStorage, not the scene
 * actually on screen. Reuses the `r3f-main.*.test.tsx` WebGL-mock pattern.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';

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

const DEFAULT_FILE = 'unit-plane-mesh.tscn';
const SWITCH_TARGET = flattenLeaves(buildFixtureTree(fixtures)).find(
  (l) => l.file !== DEFAULT_FILE
) as Leaf;

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
  await waitFor(() => {
    expect(screen.queryByText(rootName)).toBeTruthy();
  });
}

async function switchToTarget() {
  fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
  const palette = await screen.findByRole('dialog', { name: 'Open or switch scene' });
  fireEvent.change(within(palette).getByLabelText('Filter built-in scenes'), {
    target: { value: SWITCH_TARGET.label },
  });
  fireEvent.click(within(palette).getByText(SWITCH_TARGET.label));
}

beforeEach(() => {
  try {
    globalThis.localStorage.clear();
  } catch {
    // happy-dom may throw in edge cases; ignore.
  }
  window.history.replaceState(null, '', '/');
  mockFetch();
});

afterEach(() => {
  vi.restoreAllMocks();
  window.history.replaceState(null, '', '/');
});

describe('#221 deep link — ?fixture= reflects the active scene', () => {
  it('writes ?fixture=<file> back to the URL on scene switch (no reload needed)', async () => {
    render(<R3FApp />);
    await waitForScene();

    await switchToTarget();
    await waitForScene('SwitchedRoot');

    await waitFor(() => {
      expect(new URLSearchParams(window.location.search).get('fixture')).toBe(
        SWITCH_TARGET.file
      );
    });
  });

  it('reopens the same scene after a reload that reads the written-back URL', async () => {
    const first = render(<R3FApp />);
    await waitForScene();

    await switchToTarget();
    await waitForScene('SwitchedRoot');
    await waitFor(() => {
      expect(new URLSearchParams(window.location.search).get('fixture')).toBe(
        SWITCH_TARGET.file
      );
    });
    first.unmount();

    // "Reload": a fresh mount reads whatever is now in the URL.
    render(<R3FApp />);
    await waitForScene('SwitchedRoot');
  });

  it('uses history.replaceState (not pushState), so switching scenes does not grow browser history', async () => {
    const pushSpy = vi.spyOn(window.history, 'pushState');
    render(<R3FApp />);
    await waitForScene();

    await switchToTarget();
    await waitForScene('SwitchedRoot');

    expect(pushSpy).not.toHaveBeenCalled();
  });
});
