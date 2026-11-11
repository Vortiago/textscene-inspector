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
