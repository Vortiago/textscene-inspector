import type { SkyProperties } from './types';

// `sky_material.cpp:326`, `:766`, `:502`. A shader reads them through a `LIGHTn` built-in (`sky.cpp:81`).

export function materialReadsLights(material: SkyProperties): boolean {
  if (material.kind === 'shader') return material.usage.light;
  return material.kind !== 'panorama';
}
