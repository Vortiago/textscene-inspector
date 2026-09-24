/** Classes the gallery documents that ClassDB's node enumeration never yields. */

/**
 * Classes the local ClassDB does not list, such as AreaLight3D, which is newer
 * than 4.6.3, so its sheet still gets reference chips. The links are unpinned
 * (`stable`/`master`). The call site drops an entry once the local Godot lists it.
 */
export const EXTRA_CLASSES = [
  { name: 'AreaLight3D', chain: ['Light3D', 'VisualInstance3D', 'Node3D', 'Node'] },
];

/**
 * Resource classes the gallery documents. The node enumeration does not reach
 * them, but their sheets want the same docs/source chips. A chain is the Godot
 * ancestry, used as a node's is.
 */
export const RESOURCE_CLASSES = [
  { name: 'StandardMaterial3D', chain: ['BaseMaterial3D', 'Material', 'Resource'] },
  { name: 'Environment', chain: ['Resource'] },
  { name: 'Sky', chain: ['Resource'] },
  { name: 'Texture2D', chain: ['Texture', 'Resource'] },
  { name: 'ArrayMesh', chain: ['Mesh', 'Resource'] },
];
