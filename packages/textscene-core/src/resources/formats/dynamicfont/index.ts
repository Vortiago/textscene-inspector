/**
 * Dynamic font container slice, foreign-format kind (ADR-0031). The browser's `FontFace`
 * is the parser, so there is no decode/build split, and `fontBytes.ts` is the byte layer.
 * Both font slices route to the `font` bus slot, and `processors/createFontProcessor.ts`
 * dispatches on the fetched shape.
 */

import { registerResourceSlice } from '../../sliceRegistration';

import { FONT_CONTAINER_EXTENSIONS } from './fontBytes';

registerResourceSlice({
  slice: 'dynamicfont',
  kind: 'foreign-format',
  // No type name: a `FontFile` ExtResource as often names a text `.tres` wrapper, so only
  // the extension is a binary signal. `registration.test.ts` pins the split.
  typeNames: [],
  extensions: FONT_CONTAINER_EXTENSIONS,
  binaryBytes: true,
  busType: 'font',
  failureLabel: 'Node using font',
});
