/**
 * F-to-frame target resolution: the selected node when its Object3D is in
 * `SelectionContext.nodeObjectMap`, else the whole scene, as F does in Blender
 * and Godot.
 */
import type * as THREE from 'three';

export function resolveFrameTarget(
  scene: THREE.Object3D,
  selectedNodePath: string | null,
  nodeObjectMap: ReadonlyMap<string, THREE.Object3D> | null
): THREE.Object3D {
  const selected = selectedNodePath && nodeObjectMap ? nodeObjectMap.get(selectedNodePath) : undefined;
  return selected ?? scene;
}
