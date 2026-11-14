/**
 * The settled fonts of the preview a component renders in, as hooks: a reader that built against a
 * font that was not there yet renders again when that font settles, and a font that settles in
 * another preview wakes nothing here.
 */
import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';
import type { FontResource } from '../../../../resources/fonts/font/types';
import type { ResourceLoader } from '../../../../resources/ResourceLoader';
import { useResourceLoader } from '../../../../resources/useResource';
import { subscribeToNothing } from '../../../../utils/subscribeToNothing';
import { readSettledFont } from './sceneFontLoader';
import { createSettledFonts, type AwaitedFonts, type SettledFont, type SettledFonts } from './settledFonts';

/**
 * Written by the first reader with no resource loader: only a test renders a tree without one.
 * Cleared by `resetLoaderlessFonts`, which the test setup runs before each test.
 */
let loaderlessFonts: SettledFonts | null = null;

/** Drops the settled fonts of a tree with no loader, so the next test starts from an empty store. */
export function resetLoaderlessFonts(): void {
  loaderlessFonts = null;
}

/** The settled fonts of `loader`'s preview, or of a tree with no loader. */
export function settledFontsOf(loader: ResourceLoader | null): SettledFonts {
  if (loader) return loader.settledFonts;
  return (loaderlessFonts ??= createSettledFonts());
}

/** The settled fonts of the preview this component renders in. */
function useSettledFonts(): SettledFonts {
  return settledFontsOf(useResourceLoader());
}

/**
 * `font` with every face of its chain, as {@link readSettledFont} answers. The component renders
 * again when a load of that font settles, and for no other font.
 */
export function useSettledFont(font: FontResource | null | undefined, nodePath: string): SettledFont {
  const fonts = useSettledFonts();
  const subscribe = useCallback(
    (onSettle: () => void) => (font ? fonts.subscribeFont(font, onSettle) : subscribeToNothing()),
    [fonts, font]
  );
  // The preview's settles, not the font's: a sub-resource font is a new object on each render, and
  // its own version, still 0, would show React no change, so React would keep the old render.
  useSyncExternalStore(subscribe, fonts.version, fonts.version);
  return readSettledFont(fonts, font, nodePath);
}

/** A version that moves once a font the committed forest awaited settles. */
interface AwaitedFontsVersion {
  subscribe(onChange: () => void): () => void;
  get(): number;
  /** Tracks the fonts a committed forest awaits, and moves at once for one that settled since. */
  track(awaited: AwaitedFonts): void;
}

const NOTHING_AWAITED: AwaitedFonts = new Map();

/**
 * The version of one reader. `version`, `tracked` and `isMoved` are written only by
 * `moveIfSettled` and `track`. After a move it stays put until the next forest is tracked, which
 * reads anew. It watches each tracked font alone while it has a listener, so a settle of another
 * font calls nothing here.
 */
function createAwaitedFontsVersion(fonts: SettledFonts): AwaitedFontsVersion {
  let version = 0;
  let tracked = NOTHING_AWAITED;
  let isMoved = false;
  const listeners = new Set<() => void>();
  /** Written only by `watch` and `unwatchAll`: the unsubscribe of each tracked font it watches. */
  const watched = new Map<object, () => void>();
  const hasSettled = () => {
    for (const [font, readAt] of tracked) if (fonts.fontVersion(font) !== readAt) return true;
    return false;
  };
  const moveIfSettled = () => {
    if (isMoved || !hasSettled()) return;
    isMoved = true;
    version += 1;
    for (const listener of listeners) listener();
  };
  const watch = (font: object) => {
    if (listeners.size > 0 && !watched.has(font)) watched.set(font, fonts.subscribeFont(font, moveIfSettled));
  };
  const unwatchAll = () => {
    for (const unwatch of watched.values()) unwatch();
    watched.clear();
  };
  const watchTracked = () => {
    unwatchAll();
    for (const font of tracked.keys()) watch(font);
  };
  // A painter can await a font after the forest is tracked, so each newly awaited font is watched too.
  const watchIfTracked = (font: object) => {
    if (tracked.has(font)) watch(font);
  };
  /** Written only by `subscribe` and its unsubscribe: set while the version has a listener. */
  let unsubscribeAwaits: (() => void) | null = null;

  return {
    get: () => version,
    subscribe(onChange) {
      listeners.add(onChange);
      unsubscribeAwaits ??= fonts.subscribeAwaits(watchIfTracked);
      watchTracked();
      return () => {
        listeners.delete(onChange);
        if (listeners.size > 0) return;
        unsubscribeAwaits?.();
        unsubscribeAwaits = null;
        unwatchAll();
      };
    },
    track(awaited) {
      tracked = awaited;
      isMoved = false;
      moveIfSettled();
      watchTracked();
    },
  };
}

/**
 * Watches the fonts a forest of many readers awaits, as `SettledFonts.recording` collects them: the
 * version moves once one of them settles, and for no other settle. The caller passes each committed
 * forest's fonts to `track` in an effect, so a settle between the render and the commit still moves it.
 */
export function useAwaitedFontsVersion(fonts: SettledFonts): {
  version: number;
  track: (awaited: AwaitedFonts) => void;
} {
  const store = useMemo(() => createAwaitedFontsVersion(fonts), [fonts]);
  const version = useSyncExternalStore(store.subscribe, store.get, store.get);
  return { version, track: store.track };
}

/**
 * This preview's settled fonts for a reader that hands them to painters it does not watch itself,
 * such as a fallback `SolveNode`: it records each font they await, and answers a new view once one
 * of those settles, so a memo keyed on it builds again.
 */
export function useWatchedSettledFonts(): SettledFonts {
  const fonts = useSettledFonts();
  const { version, track } = useAwaitedFontsVersion(fonts);
  const watched = useMemo(() => {
    const awaited = new Map<object, number>();
    return { awaited, fonts: fonts.recording(awaited) };
    // `version` is a cache-buster: each move answers a new view, which records anew.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fonts, version]);
  useEffect(() => track(watched.awaited), [track, watched]);
  return watched.fonts;
}
