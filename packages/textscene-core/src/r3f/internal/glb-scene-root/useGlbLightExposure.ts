/**
 * Scales the lights a GLB brings by the world's exposure, as Godot scales every Light3D it imports.
 * A directional light declares its energy to the sky first: `<SkyLayer>` scales a declared energy
 * by the exposure itself, and an undeclared one is read back from the intensity.
 */

import { useLayoutEffect } from 'react';
import type * as THREE from 'three';
import { LIGHT_INTENSITY_SCALE } from '../../lightConstants';
import { useExposureFactor } from '../../environment/worldExposure';
import { skyLightUserData } from '../../sky/skyLight';

function lightsOf(object: THREE.Object3D): THREE.Light[] {
  const lights: THREE.Light[] = [];
  object.traverse((child) => {
    if ((child as THREE.Light).isLight) lights.push(child as THREE.Light);
  });
  return lights;
}

/** Holds each light of `object` at its authored intensity times the exposure, until the world unmounts. */
export function useGlbLightExposure(object: THREE.Object3D | null | undefined): void {
  const exposure = useExposureFactor();
  useLayoutEffect(() => {
    if (!object) return;
    const authored = lightsOf(object).map((light) => ({ light, intensity: light.intensity }));
    const declarations = authored
      .filter(({ light }) => (light as THREE.DirectionalLight).isDirectionalLight)
      .map(({ light, intensity }) => ({
        light,
        entries: skyLightUserData({ drawsInSky: true, energy: intensity / LIGHT_INTENSITY_SCALE, size: 0 }),
      }));
    for (const { light, entries } of declarations) Object.assign(light.userData, entries);
    for (const { light, intensity } of authored) light.intensity = intensity * exposure;
    return () => {
      for (const { light, intensity } of authored) light.intensity = intensity;
      for (const { light, entries } of declarations) {
        for (const key of Object.keys(entries)) delete light.userData[key];
      }
    };
  }, [object, exposure]);
}
