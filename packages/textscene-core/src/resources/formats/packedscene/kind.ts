/**
 * The `PACKED_SCENE` kind: a property that takes a PackedScene, as the address of the scene file.
 * A text or binary scene is no resource file the reading module parses, so it arrives as an
 * imported file. A PackedScene saved as a `.res` is a resource file, which records its class.
 * No THREE.
 */

import { isBinaryScenePath } from '../../../godot/project/binaryResourceFormat';
import { fileExtension } from '../../fileExtension';
import { IMPORTED_FILE, type ResourceKind } from '../../reading';

/** A scene file a property names. */
export interface SceneFile {
  /** The `res://` address of the scene. */
  readonly path: string;
}

export const PACKED_SCENE: ResourceKind<SceneFile> = {
  name: 'PackedScene',
  accepts: (type) => type === IMPORTED_FILE || type === 'PackedScene',
  decode: ({ type, address }) => (address && isScenePath(address, type) ? { path: address } : null),
};

function isScenePath(path: string, type: string): boolean {
  return fileExtension(path) === '.tscn' || isBinaryScenePath(path, type);
}
