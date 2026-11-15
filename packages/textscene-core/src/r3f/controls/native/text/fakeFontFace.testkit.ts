/**
 * A `FontFace` for a test of a font registration: happy-dom has none.
 */

export class FakeFontFace {
  constructor(
    readonly family: string,
    readonly source: ArrayBuffer,
    readonly descriptors?: FontFaceDescriptors
  ) {}
  load(): Promise<FakeFontFace> {
    return Promise.resolve(this);
  }
}

/**
 * A `FontFace` class that lists each face built from it. Each call lists on its own: a load an
 * earlier test left in flight registers there, never as the face of this test.
 */
export function fontFaceRecorder(): { FontFace: typeof FakeFontFace; faces: FakeFontFace[] } {
  const faces: FakeFontFace[] = [];
  class RecordedFontFace extends FakeFontFace {
    constructor(...args: ConstructorParameters<typeof FakeFontFace>) {
      super(...args);
      faces.push(this);
    }
  }
  return { FontFace: RecordedFontFace, faces };
}

/**
 * Resolves once happy-dom's window has loaded. Until then a later tick calls
 * `document.dispatchEvent`, so a test that swaps `document` for a stub first throws an unhandled rejection.
 */
export function windowLoaded(): Promise<void> {
  if (document.readyState === 'complete') return Promise.resolve();
  return new Promise((resolve) => window.addEventListener('load', () => resolve(), { once: true }));
}
