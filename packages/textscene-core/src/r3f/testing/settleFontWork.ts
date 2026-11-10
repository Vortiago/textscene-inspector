/** Test-only: waits until every font load a peek started has settled and woken its listeners. */

/**
 * Resolves when the work count a capture waits on reaches zero, with no wall-clock limit but the
 * test's own: a WOFF2 decode takes 130 ms alone and over 1 s on a loaded runner. The channel is
 * imported here, not at the top, so a test that resets its modules waits on its fresh loader's count.
 */
export async function settleFontWork(): Promise<void> {
  const { fontWork } = await import('../controls/native/text/settledChannel');
  if (fontWork.pending() === 0) return;
  await new Promise<void>((resolve) => {
    const unsubscribe = fontWork.subscribe(() => {
      if (fontWork.pending() !== 0) return;
      unsubscribe();
      resolve();
    });
  });
}

/**
 * What `peek` answers once a peek starts no font load: each peek can start the next load, as a
 * TextMesh peeks its outlines and then its metrics.
 */
export async function settledPeek<T>(peek: () => T): Promise<T> {
  const { fontWork } = await import('../controls/native/text/settledChannel');
  for (;;) {
    const value = peek();
    if (fontWork.pending() === 0) return value;
    await settleFontWork();
  }
}
