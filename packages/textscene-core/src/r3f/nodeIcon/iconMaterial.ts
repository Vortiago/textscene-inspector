/**
 * The material of a node icon, one for each icon and appearance in a renderer. Every icon of one
 * look draws through the same material object, so three uploads its uniforms once for the run of
 * them.
 */

import * as THREE from 'three';
import { perObject } from '../../utils/perObject';
import type { EditorIconName } from './editorIcons';
import { editorIconTexture } from './editorIconTexture';

/** The scissor of the icon material (`node_3d_editor_gizmos.cpp:974-975`). */
const ALPHA_SCISSOR = 0.1;

/**
 * Most materials a renderer keeps for sharing. Editing a light colour makes a new look for each
 * edit, so past this the cache starts again. A material in use outlives the reset, and a renderer
 * that is disposed frees its programs, which is why no material is disposed here.
 */
const MAX_SHARED_MATERIALS = 256;

/** Written only by `iconMaterial`. It is collected with its renderer. */
const materialsOf = perObject((_renderer: THREE.WebGLRenderer) => new Map<string, THREE.MeshBasicMaterial>());

/** `color` is linear, as `iconAppearance` gives it. */
export function iconMaterial(
  renderer: THREE.WebGLRenderer,
  icon: EditorIconName,
  color: THREE.Color,
  opacity: number
): THREE.MeshBasicMaterial {
  const materials = materialsOf(renderer);
  const key = `${icon}|${color.r}|${color.g}|${color.b}|${opacity}`;
  const shared = materials.get(key);
  if (shared) return shared;

  if (materials.size >= MAX_SHARED_MATERIALS) materials.clear();
  const material = new THREE.MeshBasicMaterial({
    map: editorIconTexture(icon),
    color,
    opacity,
    alphaTest: ALPHA_SCISSOR,
    fog: false,
    side: THREE.DoubleSide,
  });
  materials.set(key, material);
  return material;
}
