/**
 * The GLB slice's glTF extension rules (`GltfExtensionRules`). Under `godot-importer` a file
 * loads as Godot 4.6.3's importer reads it: a required extension outside Godot's set refuses
 * the file (`gltf_document.cpp:7197-7202`), and any other one is skipped.
 */

import type { GLTFLoader, GLTFLoaderPlugin, GLTFParser } from 'three/addons/loaders/GLTFLoader.js';
import { GODOT_GLTF_EXTENSIONS, unsupportedRequiredGltfExtensions } from '../../../godot/gltf';
import type { GltfExtensionRules } from './types';

type JsonRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

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
  if (!isRecord(value)) return;
  for (const [key, child] of Object.entries(value)) {
    if (key === 'extras') continue;
    if (key === 'extensions' && isRecord(child)) {
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
      const json = parser.json as { extensionsRequired?: string[] };
      const [unsupported] = unsupportedRequiredGltfExtensions(json.extensionsRequired ?? []);
      if (unsupported !== undefined) {
        throw new Error(`glTF: required extension '${unsupported}' is not supported by Godot's importer`);
      }
      dropUnimportedExtensions(json);
    },
  };
}

/** `loader`, reading extensions by `rules`. three's own loader already reads `three-loader`'s set. */
export function withExtensionRules(loader: GLTFLoader, rules: GltfExtensionRules): GLTFLoader {
  return rules === 'godot-importer' ? loader.register(godotImporter) : loader;
}
