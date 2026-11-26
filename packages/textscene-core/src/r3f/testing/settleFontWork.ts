/** Test-only: waits until every font load a peek started has settled and woken its listeners. */
import type { SettledFonts } from '../controls/native/text/settledFonts';
import type { WorkCount } from '../../resources/workCount';

/** No wall-clock limit but the test's own: a WOFF2 decode takes 130 ms alone, over 1 s on a loaded runner. */
export async function settleFontWork(work: WorkCount): Promise<void> {
  if (work.pending() === 0) return;
  await new Promise<void>((resolve) => {
    const unsubscribe = work.subscribe(() => {
      if (work.pending() !== 0) return;
      unsubscribe();
      resolve();
    });
  });
}

/** Settles a font load that nothing reads in the view of `fonts`, which should wake no reader there. */
export async function settleUnrelatedFontLoad(fonts: SettledFonts): Promise<void> {
  fonts.peekOutlines({}, () => Promise.resolve(null));
  await settleFontWork(fonts.work);
}

/** Peeks again until a peek starts no load, as a TextMesh peeks its outlines and then its metrics. */
export async function settledPeek<T>(fonts: SettledFonts, peek: () => T): Promise<T> {
  for (;;) {
    const value = peek();
    if (fonts.work.pending() === 0) return value;
    await settleFontWork(fonts.work);
  }
}
