/**
 * Dynamic font container slice — foreign-format kind (ADR-0031).
 *
 * The real parser is the browser's `FontFace`, which the text painter builds
 * from the fetched bytes; nothing here ever sees a **ParsedResource**, so
 * there is no decode/build split to make. `fontBytes.ts` beside this file is
 * the whole byte layer.
 *
 * **This slice claims NO type name, by design.** The three Godot font TYPES
 * (`FontFile`, `SystemFont`, `FontVariation`) belong to the `font` slice
 * (`resources/fonts/font/`), which is Godot-text and NOT binary — a `FontFile`
 * ExtResource just as often names a text `.tres` wrapper carrying `fallbacks`
 * rather than font bytes of its own, and fetching that as bytes yields a
 * string no parser can read. Only the EXTENSION is a binary signal, so only
 * the extension claim carries `binaryBytes`. Adding `FontFile` to `typeNames`
 * here would make `isBinaryResourceType('FontFile')` true and break every
 * `.tres`-wrapped font; `registration.test.ts` pins that apart.
 *
 * Both slices route to the same `font` bus slot: what a font-typed address
 * resolves to is a `FontResource` either way, and the processor
 * (`processors/createFontProcessor.ts`) dispatches on the fetched SHAPE —
 * bytes here, text through the Godot-text slice's decode.
 */

import { registerResourceSlice } from '../../sliceRegistration';

import { FONT_CONTAINER_EXTENSIONS } from './fontBytes';

registerResourceSlice({
  slice: 'dynamicfont',
  kind: 'foreign-format',
  typeNames: [],
  extensions: FONT_CONTAINER_EXTENSIONS,
  binaryBytes: true,
  busType: 'font',
  failureLabel: 'Node using font',
});
