/**
 * The fixture selection and its persistence, apart from the buffer: the first-visit default,
 * the `?fixture=` deep link, the localStorage choice and the URL writeback. useSceneSource
 * writes the storage key on a successful load, so only a fixture that loads is remembered.
 */
import { useEffect, useState } from 'react';

/** localStorage key remembering the last successfully loaded fixture. */
export const FIXTURE_STORAGE_KEY = 'tscn-web-r3f-fixture';

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
      // An unlisted demos/ or games/ subscene needs no catalog entry.
      const param = new URLSearchParams(window.location.search).get('fixture');
      if (
        param &&
        (fixtures.some((f) => f.file === param) ||
          param.startsWith('demos/') ||
          param.startsWith('games/'))
      ) {
        return param;
      }
      return window.localStorage.getItem(FIXTURE_STORAGE_KEY) ?? defaultFixture;
    } catch {
      return defaultFixture;
    }
  });

  // A reload or a shared URL reopens the scene on screen, not the localStorage choice.
  // `replaceState`, not `pushState`: a scene switch is no navigation for Back to step through.
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
      // An unsupported History API must never break the app.
    }
  }, [fixtureFile]);

  return { fixtureFile, setFixtureFile };
}
