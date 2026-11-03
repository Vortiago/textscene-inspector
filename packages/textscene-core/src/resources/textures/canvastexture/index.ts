/**
 * CanvasTexture resource slice entry point (ADR-0031): inline, or a standalone `.tres` on the
 * `resource` bus. THREE-free and React-free: the Texture2D resolver peels the diffuse texture, and
 * a lit item binds the normal and specular maps itself.
 */

import { registerResourceSlice } from '../../sliceRegistration';
import { CANVAS_TEXTURE_TYPE } from './types';

registerResourceSlice({
  slice: 'canvastexture',
  kind: 'godot-text',
  typeNames: [CANVAS_TEXTURE_TYPE],
  busType: 'resource',
});

export * from './decode';
export * from './types';
