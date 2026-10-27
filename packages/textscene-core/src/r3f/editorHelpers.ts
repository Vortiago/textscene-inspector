/**
 * Editor chrome on the THREE object graph: gizmos, selection and hover boxes, and debug overlays.
 * Godot draws its editor gizmos on layers 25 to 28 (`editor/scene/3d/node_3d_editor_plugin.h:187-190`),
 * past the 20 every scene mask defaults to, so a reflection probe's capture leaves them out. A tag
 * marks the root of each such subtree.
 */

import type * as THREE from 'three';

const EDITOR_HELPER_KEY = 'tscnEditorHelper';

/** The `userData` an editor-only element hands R3F, such as `<group userData={editorHelperUserData()} />`. */
export function editorHelperUserData(): { tscnEditorHelper: true } {
  return { [EDITOR_HELPER_KEY]: true };
}

/** Tags an editor-only object built outside JSX, such as a THREE helper. */
export function markEditorHelper(object: THREE.Object3D): void {
  object.userData[EDITOR_HELPER_KEY] = true;
}

/** Whether `object` is the root of editor chrome. Its children are chrome too. */
export function isEditorHelper(object: THREE.Object3D): boolean {
  return object.userData[EDITOR_HELPER_KEY] === true;
}

/** Whether `object` is the root of editor chrome or lies under one. */
export function isUnderEditorHelper(object: THREE.Object3D): boolean {
  for (let o: THREE.Object3D | null = object; o; o = o.parent) if (isEditorHelper(o)) return true;
  return false;
}
