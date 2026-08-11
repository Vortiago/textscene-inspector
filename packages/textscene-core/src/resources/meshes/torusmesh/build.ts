/**
 * TorusMesh geometry: Godot's inner/outer radii become three's centre + tube
 * radius.
 *
 * Godot resolves the pair when it builds the surface, not when it stores it
 * (`primitive_meshes.cpp:2232-2241`): equal radii ERR_FAIL the whole mesh array,
 * so nothing is drawn, and a reversed pair is SWAPped before use. Handing the raw
 * pair to three instead yields a negative tube radius and an inside-out ring.
 */

import * as THREE from 'three';
import { warn } from '../../../logger.js';
import type { TorusMeshProperties } from './types.js';

export function buildTorusMeshGeometry(p: TorusMeshProperties): THREE.BufferGeometry | null {
  if (p.innerRadius === p.outerRadius) {
    warn(
      `[TorusMesh] inner_radius equals outer_radius (${p.innerRadius}) — Godot builds no ` +
        `surface for that torus, so nothing is drawn`
    );
    return null;
  }
  const min = Math.min(p.innerRadius, p.outerRadius);
  const max = Math.max(p.innerRadius, p.outerRadius);

  // three revolves the tube around Z (ring in XY, hole facing +Z); Godot revolves
  // around Y (ring in XZ, hole facing +Y). The torus is symmetric about its ring
  // plane, so the rotation sign is immaterial.
  const geom = new THREE.TorusGeometry((max + min) / 2, (max - min) / 2, p.ringSegments, p.rings);
  geom.rotateX(Math.PI / 2);
  return geom;
}
