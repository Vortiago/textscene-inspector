/**
 * The GLB slice's glTF extension rules (`GltfExtensionRules`). Under `godot-importer` a file
 * loads as Godot 4.6.3's importer reads it: a required extension outside Godot's set refuses
 * the file (`gltf_document.cpp:7197-7202`), and any other one is skipped.
 */

import type { GLTFLoader, GLTFLoaderPlugin, GLTFParser } from 'three/addons/loaders/GLTFLoader.js';
import {
  GODOT_GLTF_EXTENSIONS,
  gltfRefusalMessage,
  isGltfJsonObject,
  requiredGltfExtensions,
  unsupportedRequiredGltfExtensions,
} from '../../../godot/gltf';
import type { GltfExtensionRules } from './types';

/**
 * Removes, from every `extensions` object in a glTF's JSON, each entry Godot does not import.
 * three's plugins read an extension only where an object carries it, so each one then skips.
 * `extras` is the author's own data, which Godot keeps as metadata, so it stays as written.
 */
function dropUnimportedExtensions(value: unknown): void {
  if (Array.isArray(value)) {
    for (const item of value) dropUnimportedExtensions(item);
    return;
  }
  if (!isGltfJsonObject(value)) return;
  for (const [key, child] of Object.entries(value)) {
    if (key === 'extras') continue;
    if (key === 'extensions' && isGltfJsonObject(child)) {
      for (const name of Object.keys(child)) {
        if (!GODOT_GLTF_EXTENSIONS.has(name)) delete child[name];
      }
    }
    dropUnimportedExtensions(child);
  }
}

/**
 * Applies Godot's rules to the parsed JSON before three reads anything from it. `beforeRoot`
 * runs after the parser marks its definitions and before it loads the scene (`GLTFLoader.js:2701-2717`).
 */
function godotImporter(parser: GLTFParser): GLTFLoaderPlugin {
  return {
    name: 'GODOT_importer_extensions',
    beforeRoot: async () => {
      const unsupported = unsupportedRequiredGltfExtensions(requiredGltfExtensions(parser.json));
      if (unsupported.length > 0) throw new Error(`glTF: ${gltfRefusalMessage(unsupported)}`);
      dropUnimportedExtensions(parser.json);
    },
  };
}

/** `loader`, reading extensions by `rules`. three's own loader already reads `three-loader`'s set. */
export function withExtensionRules(loader: GLTFLoader, rules: GltfExtensionRules): GLTFLoader {
  return rules === 'godot-importer' ? loader.register(godotImporter) : loader;
}
