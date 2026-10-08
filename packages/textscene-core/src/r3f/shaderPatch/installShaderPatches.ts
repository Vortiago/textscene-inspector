/**
 * Installs every chunk patch the preview draws with. Each canvas calls it when its renderer is
 * created, before its first frame: a program reads three's chunks and `ShaderLib` uniforms only
 * when it compiles. The 2D canvas installs the 3D patches too, since a SubViewport there can hold
 * a 3D scene. Each install changes nothing on a second call.
 */

import { installCanvasSrgbMultiply } from '../canvasSrgbMultiply.js';
import { installGodotDiffuse } from '../godotDiffuse.js';
import { installDirectionalShadowFade } from '../directionalShadow/shadowFade.js';
import { installDirectionalShadowAtlas } from '../directionalShadow/shadowAtlasChunk.js';
import { installGodotSplitShadow } from '../directionalShadow/splitShadowChunk.js';
import { installGodotPositionalShadow } from '../positionalShadow/positionalShadowChunk.js';

export function installShaderPatches(): void {
  installGodotDiffuse();
  installGodotSplitShadow();
  installDirectionalShadowAtlas();
  installDirectionalShadowFade();
  installGodotPositionalShadow();
  installCanvasSrgbMultiply();
}
