/**
 * The `PACKED_SCENE` kind: a property that takes a PackedScene, as the address of the scene file.
 * A scene file is no resource file the reading module parses, so it arrives as an imported file,
 * and a file of another format is no PackedScene. No THREE.
 */

import { BINARY_SCENE_EXTENSION } from '../../../godot/project/binaryResourceFormat';
import { fileExtension } from '../../fileExtension';
import { IMPORTED_FILE, type ResourceKind } from '../../reading';

/** A scene file a property names. */
export interface SceneFile {
  /** The `res://` address of the scene. */
  readonly path: string;
}

const SCENE_EXTENSIONS: ReadonlySet<string | null> = new Set(['.tscn', BINARY_SCENE_EXTENSION]);

export const PACKED_SCENE: ResourceKind<SceneFile> = {
  name: 'PackedScene',
  accepts: (type) => type === IMPORTED_FILE,
  decode: ({ address }) =>
    address && SCENE_EXTENSIONS.has(fileExtension(address)) ? { path: address } : null,
};
