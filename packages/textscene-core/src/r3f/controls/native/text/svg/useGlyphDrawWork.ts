import { useLayoutEffect } from 'react';
import { useViewWork } from '../../../../../resources/ResourceLoaderContext';

/** Counts each of `draws` as font work of the view until it settles, so a capture waits for the glyph. */
export function useGlyphDrawWork(draws: ReadonlySet<Promise<void>>): void {
  const fonts = useViewWork()?.fonts;
  // Layout, not passive: a frame drawn before a passive effect runs counts no draw and settles blank.
  useLayoutEffect(() => {
    if (!fonts) return undefined;
    const ends = [...draws].map((draw) => {
      const end = fonts.begin();
      void draw.then(end, end);
      return end;
    });
    return () => ends.forEach((end) => end());
  }, [fonts, draws]);
}
