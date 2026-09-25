/**
 * The toolbar's missing-resource badge. `<MissingResourcesProvider>` wraps the shell's whole
 * tree, the `toolbar` slot included, so the badge reads the same live state from
 * `useMissingResources()` as `<MissingResourcesPanel>`.
 */
import { useEffect } from 'react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
// Type-only, so plain `tsc` resolves it through the package's dist declaration. The runtime
// imports below are untyped `vi.importActual` calls, which keep the raw internal sources
// (a relative path past the `exports` map) out of this app's TypeScript program.
import type { MissingResourcesContextValue } from '@textscene/core';

// `ViewportArea` mounts `<TscnCanvas>` in 3D mode whatever the fetch does, so this flag
// decides whether the stand-in reports a missing path.
let reportOnMount = true;

// `ViewportArea` imports `TscnCanvas` by relative path, not through the barrel, and `vi.mock`
// keys by resolved path, so the mock targets the source file. The stand-in calls the real
// `report()` on mount, without the useResource and fetch machinery.
vi.mock('../../../packages/textscene-core/src/r3f/TscnCanvas', async () => {
  const real = (await vi.importActual(
    '../../../packages/textscene-core/src/r3f/TscnCanvas'
  )) as Record<string, unknown>;
  // The leaf context module, not the barrel: the barrel's graph passes back through this
  // `TscnCanvas` file, so its `useMissingResources` is `undefined` inside this factory.
  const { useMissingResources } = (await vi.importActual(
    '../../../packages/textscene-core/src/r3f/contexts/MissingResourcesContext'
  )) as { useMissingResources: () => MissingResourcesContextValue };
  function MissingResourceStandIn() {
    const { report } = useMissingResources();
    useEffect(() => {
      if (reportOnMount) report('res://textures/missing.png');
    }, [report]);
    return null;
  }
  return { ...real, TscnCanvas: MissingResourceStandIn };
});

import { R3FApp } from './r3f-main';

const STUB_TSCN = `[gd_scene load_steps=1 format=3]

[node name="StubRoot" type="Node3D"]
`;

function resetPersistence() {
  try {
    globalThis.localStorage.clear();
  } catch {
    // happy-dom can throw here, and clearing storage is optional.
  }
}

function mockFetch() {
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: true,
    text: () => Promise.resolve(STUB_TSCN),
  } as unknown as Response) as unknown as typeof fetch;
}

async function waitForScene(rootName = 'StubRoot') {
  await waitFor(() => {
    expect(screen.queryByText(rootName)).toBeTruthy();
  });
}

beforeEach(() => {
  reportOnMount = true;
  resetPersistence();
  mockFetch();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('#221 missing-resource badge', () => {
  it('shows a badge with the missing-resource count once a node reports one missing', async () => {
    render(<R3FApp />);
    await waitForScene();

    await waitFor(() => {
      expect(screen.queryByTestId('missing-resources-badge')).toBeTruthy();
    });
    expect(screen.getByTestId('missing-resources-badge').textContent).toContain('1');
  });

  it('shows no badge when nothing has been reported missing', async () => {
    reportOnMount = false;
    render(<R3FApp />);
    await waitForScene();

    expect(screen.queryByTestId('missing-resources-badge')).toBeNull();
  });
});
