/**
 * Font resource slice, Godot-text kind (ADR-0031). A resolved Font is plain data, so the
 * text painter registers the `FontFace` and there is no `build.ts`. The `dynamicfont`
 * slice claims the raw extensions, since a `FontFile` ExtResource as often names a text
 * `.tres` wrapper. No slice claims `.tres`, the shared Godot-text container.
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
