/** Classes the gallery documents that ClassDB's NODE enumeration never yields. */

/**
 * Classes the previewer documents that the LOCAL Godot's ClassDB does not list —
 * AreaLight3D exists in current Godot but not in 4.6.3, and the links are
 * deliberately unpinned to `stable`/`master`. Without this its sheet is the one
 * gallery entry with no reference chips. An entry self-heals into `nodes` the
 * day the local Godot lists it (see the dedup filter at the call site).
 */
export const EXTRA_CLASSES = [
  { name: 'AreaLight3D', chain: ['Light3D', 'VisualInstance3D', 'Node3D', 'Node'] },
];

/**
 * Resource classes the gallery documents. ClassDB's node enumeration does not
 * reach them (they are Resources, not Nodes), but their sheets want the same
 * docs/source chips, and this run is the only place holding the source index.
 * Chains are their Godot ancestry, used the same way as a node's.
 */
export const RESOURCE_CLASSES = [
  { name: 'StandardMaterial3D', chain: ['BaseMaterial3D', 'Material', 'Resource'] },
  { name: 'Environment', chain: ['Resource'] },
  { name: 'Sky', chain: ['Resource'] },
  { name: 'Texture2D', chain: ['Texture', 'Resource'] },
  { name: 'ArrayMesh', chain: ['Mesh', 'Resource'] },
];
