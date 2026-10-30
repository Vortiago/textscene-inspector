/** Which of a material's maps read Godot's `UV`, the first UV set, by three's texture coordinate. */

import * as THREE from 'three';

/**
 * Whether the map behind coordinate `uv` reads UV1. `uv` is three's `v<Map>Uv`, the coordinate of
 * the material's `<map>`. three keys each map's UV channel into the program, so a rebind to another
 * channel compiles a patch that reads this again.
 *
 * @canonical A map's UV set, from its three coordinate
 */
export function readsUv1(material: THREE.Material, uv: string): boolean {
  const mapName = uv.charAt(1).toLowerCase() + uv.slice(2, -'Uv'.length);
  const map = (material as unknown as Record<string, unknown>)[mapName];
  return !(map instanceof THREE.Texture) || map.channel === 0;
}
