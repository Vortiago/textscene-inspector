/** The three fog an Environment gives its scene. */

import * as THREE from 'three';
import type { EnvironmentSettings } from '../../resources/environment/types';
import { godotColorToLinear } from '../godotColor';

/**
 * The scene's three fog, which turns on every material's fog program. Godot's depth fog maps to
 * exponential-squared fog, the closest three match, and DEPTH mode (1) uses the same density. A
 * volume without depth fog takes a fog of density 0, which only carries the program.
 */
export function sceneFogFor({
  fog,
  volumetricFog,
}: Pick<EnvironmentSettings, 'fog' | 'volumetricFog'>): THREE.FogExp2 | null {
  if (fog) return new THREE.FogExp2(godotColorToLinear(fog.color).getHex(), fog.density);
  return volumetricFog ? new THREE.FogExp2(0x000000, 0) : null;
}
