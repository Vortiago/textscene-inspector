/**
 * Issue #221 — missing-resource badge: today a scene's missing `res://`
 * dependencies are silent unless the user has the Resources tab open.
 *
 * `useMissingResources()` (from `@textscene/core`) is the shell's own
 * aggregation of "which paths did a node in the tree report as missing" —
 * the context lives in `<MissingResourcesProvider>`, which wraps
 * `TscnPreviewShell`'s entire rendered tree INCLUDING the `toolbar` slot, so
 * a badge inside our own `<Toolbar>` reads the same live state the shell's
 * `<MissingResourcesPanel>` does.
 *
 * `TscnCanvas` normally renders `<Canvas><TscnSceneContents/></Canvas>` —
 * inaccessible under happy-dom (no WebGL). `ViewportArea` (inside the real,
 * unmocked `TscnPreviewShell`) imports `TscnCanvas` via a relative path
 * INTO the core package, not through the `@textscene/core` root barrel — so
 * mocking the barrel's `TscnCanvas` export (the pattern the other
 * `r3f-main.*.test.tsx` files use) never actually replaces what
 * `ViewportArea` renders; Vitest/Vite key `vi.mock` by resolved absolute
 * module path, so the mock target here is the concrete source file itself.
 * The stand-in calls the REAL `report()` from `useMissingResources()` on
 * mount (when `reportOnMount` is true), simulating "a node in the tree
 * asked for a resource that isn't there" without needing the full
 * useResource/fetch machinery (already covered by
 * `MissingResourcesPanel.test.tsx` in core). `ViewportArea` mounts
 * `<TscnCanvas>` unconditionally in 3D mode, so a module-level flag — not
 * the fetch outcome — toggles whether the stand-in reports, keeping the
 * "nothing missing" case in the same mocked module.
 */
import { useEffect } from 'react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
// Type-only — resolves through the package's own dist declaration under
// plain `tsc`, so it carries no `rootDir` baggage. The runtime imports below
// are untyped `vi.importActual` calls specifically so they DON'T pull the
// raw internal source files (reached via a bare relative path, bypassing the
// package's `exports` map entirely) into this app's TypeScript program.
import type { MissingResourcesContextValue } from '@textscene/core';

let reportOnMount = true;

vi.mock('../../../packages/textscene-core/src/r3f/TscnCanvas', async () => {
  const real = (await vi.importActual(
    '../../../packages/textscene-core/src/r3f/TscnCanvas'
  )) as Record<string, unknown>;
  // Import straight from the leaf context module, NOT the `@textscene/core`
  // barrel: the barrel's own module graph passes back through this very
  // `TscnCanvas` file, so `importActual`-ing the barrel from inside its mock
  // factory hits a half-initialized circular module (`useMissingResources`
  // resolves to `undefined` there).
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
    // happy-dom may throw in edge cases; ignore.
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
