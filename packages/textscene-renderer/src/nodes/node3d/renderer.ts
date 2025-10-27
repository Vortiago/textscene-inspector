/**
 * Node3D renderer - renders Node3D nodes using three.js.
 */

import * as THREE from 'three';
import type { Node3DProperties } from './types';
import { decomposeTransform3D } from '../../utils/transform';

/**
 * Create a visual gizmo for a Node3D node (colored cube).
 */
export function createNode3DGizmo(nodeName: string): THREE.Object3D {
  const geometry = new THREE.BoxGeometry(0.5, 0.5, 0.5);

  const color = getColorForNode(nodeName);
  const material = new THREE.MeshStandardMaterial({
    color,
    metalness: 0.3,
    roughness: 0.7,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = nodeName;

  const group = new THREE.Group();
  group.name = nodeName;
  group.add(mesh);

  return group;
}

/**
 * Apply transform properties to a three.js object.
 */
export function applyNode3DTransform(
  object: THREE.Object3D,
  properties: Node3DProperties
): void {
  if (!properties.transform) {
    return;
  }

  const { position, rotation, scale } = decomposeTransform3D(properties.transform);

  object.position.set(position.x, position.y, position.z);
  object.rotation.set(rotation.x, rotation.y, rotation.z);
  object.scale.set(scale.x, scale.y, scale.z);
}

/**
 * Generate a consistent color for a node name using simple hash.
 */
function getColorForNode(nodeName: string): number {
  let hash = 0;
  for (let i = 0; i < nodeName.length; i++) {
    hash = ((hash << 5) - hash) + nodeName.charCodeAt(i);
    hash = hash & hash;
  }

  const hue = Math.abs(hash % 360);
  const saturation = 70;
  const lightness = 60;

  return hslToRgb(hue, saturation, lightness);
}

function hslToRgb(h: number, s: number, l: number): number {
  h = h / 360;
  s = s / 100;
  l = l / 100;

  let r, g, b;

  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;

    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }

  const r255 = Math.round(r * 255);
  const g255 = Math.round(g * 255);
  const b255 = Math.round(b * 255);

  return (r255 << 16) | (g255 << 8) | b255;
}
