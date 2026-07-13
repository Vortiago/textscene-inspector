/**
 * Unit tests for `useFixtureSelection` — deep-link init, localStorage
 * persistence, URL writeback. Pure selection persistence; zero buffer
 * interaction.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useFixtureSelection } from './useFixtureSelection';

const STORAGE_KEY = 'tscn-web-r3f-fixture';

/** A minimal fixture catalog for tests. */
const FIXTURES = [
  { file: 'unit-plane-mesh.tscn', name: 'Plane Mesh', category: 'unit' },
  { file: 'unit-box-mesh.tscn', name: 'Box Mesh', category: 'unit' },
];

const DEFAULT_FILE = 'unit-plane-mesh.tscn';

beforeEach(() => {
  try {
    globalThis.localStorage.clear();
  } catch {
    // ignore
  }
  window.history.replaceState(null, '', '/');
});

afterEach(() => {
  vi.restoreAllMocks();
  window.history.replaceState(null, '', '/');
});

// ---------------------------------------------------------------------------
// Initial fixture selection
// ---------------------------------------------------------------------------

describe('initial selection', () => {
  it('returns the defaultFixture when localStorage and URL have no stored choice', () => {
    const { result } = renderHook(() =>
      useFixtureSelection({ fixtures: FIXTURES, defaultFixture: DEFAULT_FILE })
    );

    expect(result.current.fixtureFile).toBe(DEFAULT_FILE);
  });

  it('returns the stored fixture from localStorage on a returning visit', () => {
    globalThis.localStorage.setItem(STORAGE_KEY, 'unit-box-mesh.tscn');

    const { result } = renderHook(() =>
      useFixtureSelection({ fixtures: FIXTURES, defaultFixture: DEFAULT_FILE })
    );

    expect(result.current.fixtureFile).toBe('unit-box-mesh.tscn');
  });

  it('uses the ?fixture= query param over localStorage when both are present', () => {
    globalThis.localStorage.setItem(STORAGE_KEY, 'unit-box-mesh.tscn');
    window.history.replaceState(null, '', '/?fixture=unit-plane-mesh.tscn');

    const { result } = renderHook(() =>
      useFixtureSelection({ fixtures: FIXTURES, defaultFixture: DEFAULT_FILE })
    );

    expect(result.current.fixtureFile).toBe('unit-plane-mesh.tscn');
  });

  it('accepts an unlisted fixture from the ?fixture= param when it starts with demos/', () => {
    window.history.replaceState(null, '', '/?fixture=demos/my-demo/scene.tscn');

    const { result } = renderHook(() =>
      useFixtureSelection({ fixtures: FIXTURES, defaultFixture: DEFAULT_FILE })
    );

    expect(result.current.fixtureFile).toBe('demos/my-demo/scene.tscn');
  });

  it('accepts an unlisted fixture from the ?fixture= param when it starts with games/', () => {
    window.history.replaceState(null, '', '/?fixture=games/my-game/level.tscn');

    const { result } = renderHook(() =>
      useFixtureSelection({ fixtures: FIXTURES, defaultFixture: DEFAULT_FILE })
    );

    expect(result.current.fixtureFile).toBe('games/my-game/level.tscn');
  });

  it('ignores a ?fixture= param that is not in the catalog and not a demos/ or games/ path', () => {
    window.history.replaceState(null, '', '/?fixture=unknown-fixture.tscn');

    const { result } = renderHook(() =>
      useFixtureSelection({ fixtures: FIXTURES, defaultFixture: DEFAULT_FILE })
    );

    // Falls back to localStorage/default.
    expect(result.current.fixtureFile).toBe(DEFAULT_FILE);
  });
});

// ---------------------------------------------------------------------------
// URL writeback on fixture change
// ---------------------------------------------------------------------------

describe('URL writeback', () => {
  it('writes ?fixture= to the URL when the fixture changes', async () => {
    const { result } = renderHook(() =>
      useFixtureSelection({ fixtures: FIXTURES, defaultFixture: DEFAULT_FILE })
    );

    act(() => {
      result.current.setFixtureFile('unit-box-mesh.tscn');
    });

    await waitFor(() => {
      expect(new URLSearchParams(window.location.search).get('fixture')).toBe(
        'unit-box-mesh.tscn'
      );
    });
  });

  it('removes ?fixture= from the URL when the fixture is cleared', async () => {
    window.history.replaceState(null, '', '/?fixture=unit-plane-mesh.tscn');

    const { result } = renderHook(() =>
      useFixtureSelection({ fixtures: FIXTURES, defaultFixture: DEFAULT_FILE })
    );

    act(() => {
      result.current.setFixtureFile('');
    });

    await waitFor(() => {
      expect(new URLSearchParams(window.location.search).get('fixture')).toBeNull();
    });
  });

  it('uses history.replaceState (not pushState) so switching scenes does not grow browser history', async () => {
    const pushSpy = vi.spyOn(window.history, 'pushState');

    const { result } = renderHook(() =>
      useFixtureSelection({ fixtures: FIXTURES, defaultFixture: DEFAULT_FILE })
    );

    act(() => {
      result.current.setFixtureFile('unit-box-mesh.tscn');
    });

    await waitFor(() => {
      expect(new URLSearchParams(window.location.search).get('fixture')).toBe(
        'unit-box-mesh.tscn'
      );
    });

    expect(pushSpy).not.toHaveBeenCalled();
  });
});
