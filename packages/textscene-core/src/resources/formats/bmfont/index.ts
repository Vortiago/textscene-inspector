/**
 * BMFont slice, foreign-format kind (ADR-0031): the AngelCode bitmap font Godot imports as a
 * `FontFile` (`parseDescriptor.ts`, `pageFill.ts`, `loadBitmapFont.ts`). It routes to the `font` bus
 * slot beside the dynamic-font containers, and `processors/createFontProcessor.ts` dispatches on the
 * path. It claims no type name: a `FontFile` ExtResource as often names a `.tres` wrapper.
 */

import { registerResourceSlice } from '../../sliceRegistration';

import { BMFONT_EXTENSIONS } from './extensions';

registerResourceSlice({
  slice: 'bmfont',
  kind: 'foreign-format',
  typeNames: [],
  extensions: BMFONT_EXTENSIONS,
  binaryBytes: true,
  busType: 'font',
});
