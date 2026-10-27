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

/**
 * Hides every visible object of `scene` that `shouldHide` picks, and answers the call that shows them
 * again. A subtree that is already hidden stays hidden through the restore.
 *
 * @canonical Hide the scene objects a pass must not draw, and show them again after it
 */
export function hideObjects(
  scene: THREE.Object3D,
  shouldHide: (object: THREE.Object3D) => boolean
): () => void {
  const hidden: THREE.Object3D[] = [];
  scene.traverseVisible((object) => {
    if (shouldHide(object)) hidden.push(object);
  });
  for (const object of hidden) object.visible = false;
  return () => {
    for (const object of hidden) object.visible = true;
  };
}

/**
 * Hides every editor chrome subtree of `scene`. A pass through a camera that is not the editor's
 * draws no chrome, as Godot's gizmos live in the editor viewport alone. A node icon aligned to the
 * editor camera would also draw skewed.
 */
export function hideEditorHelpers(scene: THREE.Object3D): () => void {
  return hideObjects(scene, isEditorHelper);
}

const NODE_ICON_KEY = 'tscnNodeIcon';

/**
 * The `userData` of a node's billboard icon. Its size follows the camera, so no bounds include it:
 * not the framing, not the hover and selection boxes of its node.
 */
export function nodeIconUserData(): { tscnNodeIcon: true } {
  return { [NODE_ICON_KEY]: true };
}

/** Whether `object` is a node's billboard icon. */
export function isNodeIcon(object: THREE.Object3D): boolean {
  return object.userData[NODE_ICON_KEY] === true;
}
