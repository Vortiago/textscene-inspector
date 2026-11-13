/**
 * The kind of what fills a FogVolume, from any origin. A ShaderMaterial follows its shader in the
 * tables of the file that holds the material, so a shader written as an `ExtResource` of a `.tres`
 * resolves there.
 */

import { ShaderMode } from '../../../godot/rendering/shaderLanguage';
import type { ResourceKind } from '../../reading';
import { decodeFogMaterial } from './decode';
import { SHADER_MODE } from './shaderMode';
import type { FogVolumeMaterial } from './types';

export const FOG_VOLUME_MATERIAL: ResourceKind<FogVolumeMaterial> = {
  name: 'FogVolumeMaterial',
  accepts: (type) => type === 'FogMaterial' || type === 'ShaderMaterial',
  decode: ({ type, properties }, follow) => {
    if (type === 'FogMaterial') {
      const { density_texture: densityTexture } = properties;
      return {
        kind: 'material',
        material: decodeFogMaterial(properties),
        densityTexture: densityTexture === undefined ? null : follow.reference(densityTexture),
      };
    }
    const { shader } = properties;
    if (shader === undefined) return { kind: 'default' };
    return follow.read(SHADER_MODE, shader).value === ShaderMode.FOG
      ? { kind: 'shader', shader }
      : { kind: 'default' };
  },
};
