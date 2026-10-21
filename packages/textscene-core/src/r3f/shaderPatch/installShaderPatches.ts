/**
 * Installs every chunk patch the preview draws with. Each canvas calls it when its renderer is
 * created, before its first frame: a program reads three's chunks and `ShaderLib` uniforms only
 * when it compiles. The 2D canvas installs the 3D patches too, since a SubViewport there can hold
 * a 3D scene. Each install changes nothing on a second call.
 */

import { installCanvasSrgbMultiply } from '../canvasSrgbMultiply.js';
import { installGodotAreaLight } from '../areaLight/areaLightChunk.js';
import { installGodotClearcoat } from '../godotClearcoat.js';
import { installGodotLightAttenuation } from '../godotLightAttenuation.js';
import { installGodotIndirectSpecular } from '../godotIndirectSpecular.js';
import { installGodotLightFunction } from '../godotLightFunction.js';
import { installGodotLightSpecular } from '../lightSpecular/lightSpecularChunk.js';
import { installGodotLightBakeMode } from '../lightBakeMode/lightBakeModeChunk.js';
import { installGodotLightSize } from '../lightSize/lightSizeChunk.js';
import { installGodotSkyLighting } from '../godotSkyLighting.js';
import { installGodotReflectionProbes } from '../reflectionProbe/probeShaderChunk.js';
import { installDirectionalShadowAtlas } from '../directionalShadow/shadowAtlasChunk.js';
import { installGodotSplitShadow } from '../directionalShadow/splitShadowChunk.js';
import { installGodotPositionalShadow } from '../positionalShadow/positionalShadowChunk.js';
import { installFogComposite } from '../fog/fogComposite.js';
import { installSkyProjection } from '../sky/skyProjection.js';
import { installSkyDebanding } from '../sky/skyDebanding.js';

export function installShaderPatches(): void {
  installGodotIndirectSpecular();
  installGodotLightSpecular();
  installGodotLightBakeMode();
  installGodotLightSize();
  installGodotLightFunction();
  installGodotLightAttenuation();
  installGodotSkyLighting();
  installGodotAreaLight();
  installGodotClearcoat();
  installGodotReflectionProbes();
  installGodotSplitShadow();
  installDirectionalShadowAtlas();
  installGodotPositionalShadow();
  installCanvasSrgbMultiply();
  installFogComposite();
  installSkyProjection();
  installSkyDebanding();
}
