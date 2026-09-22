/**
 * Font resource slice — Godot-text kind (ADR-0031).
 *
 * `decode.ts` turns a Font **ParsedResource** section into a `FontResource`,
 * from either arrival (an external `.tres`'s `[resource]`/`[sub_resource]`, or
 * a scene's own inline `[sub_resource]`). There is no `build.ts`: a resolved
 * Font is plain data plus bytes, and the THREE/DOM-side work — registering a
 * `FontFace`, shaping — belongs to the text painter, not to the resource.
 *
 * No `extensions` claim here. A Font's raw containers (`.ttf`/`.otf`/`.woff`/
 * `.woff2`) are claimed by the `dynamicfont` slice
 * (`resources/formats/dynamicfont/`), which is where `binaryBytes` lives:
 * these three TYPE names must never be a binary signal, because a `FontFile`
 * ExtResource just as often names a text `.tres` wrapper. `.tres` itself is
 * never claimed — it is the shared Godot-text container.
 */

import { registerResourceSlice } from '../../sliceRegistration';

registerResourceSlice({
  slice: 'font',
  kind: 'godot-text',
  typeNames: ['FontFile', 'SystemFont', 'FontVariation'],
  busType: 'font',
  failureLabel: 'Node using font',
});

export type {
  FontCacheReader,
  FontFileResource,
  FontLoaderFn,
  FontResource,
  FontVariationResource,
  SystemFontResource,
} from './types';
