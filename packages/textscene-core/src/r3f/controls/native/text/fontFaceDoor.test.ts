/**
 * The door a font reaches the page through, against a stubbed `FontFace`: happy-dom has none.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fontFaceRecorder } from './fakeFontFace.testkit';
import { registerFontFace } from './fontFaceDoor';

/** Installs the stubbed door. Answers the faces built, and the faces the document holds. */
function installFontFace() {
  const { FontFace, faces } = fontFaceRecorder();
  const added: unknown[] = [];
  vi.stubGlobal('FontFace', FontFace);
  Object.defineProperty(document, 'fonts', {
    configurable: true,
    value: { add: (face: unknown) => added.push(face) },
  });
  return { faces, added, FontFace };
}

describe('registerFontFace', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    Reflect.deleteProperty(document, 'fonts');
  });

  it('adds a face built from the bytes in hand, under the family and the descriptors given', async () => {
    const { faces, added } = installFontFace();
    const bytes = new ArrayBuffer(4);

    const doc = await registerFontFace('door-test', () => bytes, { weight: '600' });

    const [face] = faces;
    expect(face).toMatchObject({ family: 'door-test', source: bytes, descriptors: { weight: '600' } });
    expect(added).toEqual([face]);
    expect(doc).toBe(document);
  });

  it('answers undefined with no FontFace, and leaves the bytes undecoded (edge case)', async () => {
    const bytes = vi.fn(() => new ArrayBuffer(4));

    expect(await registerFontFace('door-test', bytes)).toBeUndefined();
    expect(bytes).not.toHaveBeenCalled();
  });

  it('rejects for bytes that are not a font, and adds no face (error path)', async () => {
    const { added, FontFace } = installFontFace();
    vi.spyOn(FontFace.prototype, 'load').mockRejectedValue(new Error('bad font bytes'));

    await expect(registerFontFace('door-test', () => new ArrayBuffer(4))).rejects.toThrow('bad font bytes');
    expect(added).toEqual([]);
  });
});
