/**
 * useFixtureSelection — deep-link init, localStorage persistence, URL writeback.
 *
 * Pure selection persistence; zero buffer interaction. Owns:
 *   - first-visit default selection
 *   - `?fixture=` deep-link read at mount
 *   - localStorage read/write
 *   - `?fixture=` URL writeback via history.replaceState on every switch
 */
import { useEffect, useState } from 'react';

const STORAGE_KEY = 'tscn-web-r3f-fixture';

export interface FixtureEntry {
  file: string;
  name: string;
  category: string;
}

export interface UseFixtureSelectionOptions {
  /** Full fixture catalog used to validate the ?fixture= param. */
  fixtures: readonly FixtureEntry[];
  /** Fallback fixture file when no stored choice or valid deep-link is present. */
  defaultFixture: string;
}

export interface UseFixtureSelectionResult {
  /** The currently selected fixture file path. Empty string means "on an upload". */
  fixtureFile: string;
  /** Switch to a different fixture (or clear with ''). */
  setFixtureFile: (file: string) => void;
}

export function useFixtureSelection({
  fixtures,
  defaultFixture,
}: UseFixtureSelectionOptions): UseFixtureSelectionResult {
  const [fixtureFile, setFixtureFile] = useState<string>(() => {
    try {
      // Deep-link: `?fixture=<file>` opens directly on a specific scene.
      // Unlisted demos/ and games/ subscenes are accepted without catalog check.
      const param = new URLSearchParams(window.location.search).get('fixture');
      if (
        param &&
        (fixtures.some((f) => f.file === param) ||
          param.startsWith('demos/') ||
          param.startsWith('games/'))
      ) {
        return param;
      }
      return window.localStorage.getItem(STORAGE_KEY) ?? defaultFixture;
    } catch {
      return defaultFixture;
    }
  });

  // Write `?fixture=` back on every scene switch — so reloading or sharing
  // the URL reopens the scene actually on screen, not whatever localStorage
  // remembered. `replaceState` (never `pushState`): switching scenes is not
  // a navigation the user expects Back to step through.
  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      if (fixtureFile) {
        url.searchParams.set('fixture', fixtureFile);
      } else {
        url.searchParams.delete('fixture');
      }
      window.history.replaceState(null, '', url);
    } catch {
      // Best-effort — an unsupported History API must never break the app.
    }
  }, [fixtureFile]);

  return { fixtureFile, setFixtureFile };
}
