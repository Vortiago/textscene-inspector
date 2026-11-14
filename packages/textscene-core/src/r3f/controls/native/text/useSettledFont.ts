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

/** Written once, by the first reader with no resource loader: only a test renders a tree without one. */
let loaderlessFonts: SettledFonts | null = null;

/** The settled fonts of `loader`'s preview, or of a tree with no loader. */
export function settledFontsOf(loader: ResourceLoader | null): SettledFonts {
  if (loader) return loader.settledFonts;
  return (loaderlessFonts ??= createSettledFonts());
}

/** The settled fonts of the preview this component renders in. */
export function useSettledFonts(): SettledFonts {
  return settledFontsOf(useResourceLoader());
}

/**
 * `font` with every face of its chain, as {@link readSettledFont} answers. The component renders
 * again when a load of that font settles, and for no other font. The version is the snapshot, so a
 * load that settles between a render and the subscription still re-renders it.
 */
export function useSettledFont(font: FontResource | null | undefined, nodePath: string): SettledFont {
  const fonts = useSettledFonts();
  const subscribe = useCallback(
    (onSettle: () => void) => (font ? fonts.subscribeFont(font, onSettle) : subscribeToNothing()),
    [fonts, font]
  );
  const version = useCallback(() => (font ? fonts.fontVersion(font) : 0), [fonts, font]);
  useSyncExternalStore(subscribe, version, version);
  return readSettledFont(fonts, font, nodePath);
}

/**
 * Watches every settle of this preview's font loads only while `isAwaitingFont`: a reader that reads
 * its fonts through a build of its own, not through one font, waits on them so. A reader with no
 * font to wait for never re-renders. The snapshot is the same in both branches: one that switched
 * with the branch left the reader a render behind when the wait ended.
 */
export function usePreviewFontSettles(isAwaitingFont: boolean): number {
  const fonts = useSettledFonts();
  return useSyncExternalStore(
    isAwaitingFont ? fonts.subscribe : subscribeToNothing,
    fonts.version,
    fonts.version
  );
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
 * reads anew.
 */
function createAwaitedFontsVersion(fonts: SettledFonts): AwaitedFontsVersion {
  let version = 0;
  let tracked = NOTHING_AWAITED;
  let isMoved = false;
  const listeners = new Set<() => void>();
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

  return {
    get: () => version,
    subscribe(onChange) {
      listeners.add(onChange);
      const unsubscribe = fonts.subscribe(moveIfSettled);
      return () => {
        unsubscribe();
        listeners.delete(onChange);
      };
    },
    track(awaited) {
      tracked = awaited;
      isMoved = false;
      moveIfSettled();
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
