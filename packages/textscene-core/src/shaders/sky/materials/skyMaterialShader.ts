import { panoramaSkyMaterial } from './panoramaSkyMaterial.js';
import { physicalSkyMaterial } from './physicalSkyMaterial.js';
import { proceduralSkyMaterial } from './proceduralSkyMaterial.js';
import type { SkyMaterialGenerator, SkyMaterialProperties, SkyMaterialShader } from './skyMaterial.js';

export type { SkyMaterialProperties, SkyMaterialShader } from './skyMaterial.js';

const GENERATORS: Readonly<Record<string, SkyMaterialGenerator>> = {
  ProceduralSkyMaterial: proceduralSkyMaterial,
  PanoramaSkyMaterial: panoramaSkyMaterial,
  PhysicalSkyMaterial: physicalSkyMaterial,
};

/**
 * Null for a class that is not one of Godot's three sky materials.
 * @canonical Write the shader text of a ProceduralSkyMaterial, a PanoramaSkyMaterial or a PhysicalSkyMaterial.
 */
export function skyMaterialShader(
  className: string,
  material: SkyMaterialProperties
): SkyMaterialShader | null {
  return Object.hasOwn(GENERATORS, className) ? GENERATORS[className]!(material) : null;
}
