/**
 * F-to-frame target resolution (#224): frame the selected node if one is
 * selected AND its Object3D is registered (`SelectionContext.nodeObjectMap`,
 * the same map `SelectionHighlight` uses); otherwise frame the whole scene —
 * matching common DCC-tool convention (Blender/Godot: F frames the
 * selection, or everything when nothing is selected).
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
