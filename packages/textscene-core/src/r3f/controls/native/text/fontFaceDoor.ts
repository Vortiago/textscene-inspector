/**
 * The one door through which a font reaches the page: a `FontFace` built from bytes in hand. The
 * scene fonts of `sceneFontLoader.ts` and the bundled font of `bundledFontLoader.ts` both pass it.
 */

/**
 * happy-dom has neither `FontFace` nor a 2D canvas context, so under vitest a loader settles on its
 * fallback before any DOM font API. The skip is deliberate, so it does not warn.
 * `r3f/internalTextLabel.tsx` skips drei's `<Text>` on it too.
 */
export const IS_VITEST = (() => {
  const proc = (globalThis as { process?: { env?: { VITEST?: string } } }).process;
  return proc?.env?.VITEST === 'true';
})();

/**
 * The CSP-validated door (`default-src 'none'`, no `connect-src` or `font-src`):
 * bytes in hand go to `new FontFace` and `document.fonts.add`, with no fetch of any URL, no worker,
 * eval or WASM. Resolves to `undefined` with no `FontFace`, and rejects only on bytes that are not
 * a font, so `bytes` is a thunk that does not decode where there is no door.
 */
export async function registerFontFace(
  family: string,
  bytes: () => ArrayBuffer,
  descriptors?: FontFaceDescriptors
): Promise<Document | undefined> {
  // Read lazily: a non-DOM environment answers `undefined`, and a late `document.fonts` is still seen.
  const { FontFace: FontFaceCtor, document: doc } = globalThis as {
    FontFace?: typeof FontFace;
    document?: Document;
  };
  if (!FontFaceCtor || !doc?.fonts) return undefined;
  const face = new FontFaceCtor(family, bytes(), descriptors);
  await face.load();
  doc.fonts.add(face);
  return doc;
}
