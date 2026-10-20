/**
 * The loop mode and name Godot's scene importer gives an imported glTF clip: the glTF name rule,
 * the name suffix rule and the sidecar's `_subresources` entry, applied in that order.
 */

import { validateNodeName } from '../string/nodeName.js';
import { AnimationLoopMode } from '../scene/animation.js';

export interface ClipImportOptions {
  /** `nodes/use_name_suffixes` (`resource_importer_scene.cpp:640-645`), true by default. */
  useNameSuffixes: boolean;
  /**
   * `settings/loop_mode` of each `_subresources.animations` entry, by the clip's final name. An
   * entry without the key reads as its default, LOOP_NONE (`resource_importer_scene.cpp:1337-1344`).
   */
  sidecarLoopModes: ReadonlyMap<string, number>;
}

interface ImportedClip {
  /** The name after the importer strips a loop suffix. */
  name: string;
  loopMode: number;
}

/** The suffixes `_pre_fix_node` tests in this order (`resource_importer_scene.cpp:746-756`). */
const LOOP_SUFFIXES = ['loop_mode', 'loop', 'cycle'] as const;

/**
 * How Godot imports the clips a glTF names `gltfNames`, in order. The name rule reads the name
 * the glTF wrote. Everything after it, the suffix rule and the sidecar entry, reads the name
 * the glTF importer stores (`gltf_document.cpp:3751-3756`).
 */
export function importedClips(gltfNames: readonly string[], options: ClipImportOptions): ImportedClip[] {
  const takenNames = new Set<string>();
  return gltfNames.map((gltfName) => {
    let loopMode: number = namesLoop(gltfName) ? AnimationLoopMode.LINEAR : AnimationLoopMode.NONE;
    let name = uniqueName(gltfName, takenNames);
    if (options.useNameSuffixes) {
      for (const suffix of LOOP_SUFFIXES) {
        const stripped = withoutMarker(name, suffix);
        if (stripped === null) continue;
        loopMode = AnimationLoopMode.LINEAR;
        name = stripped;
      }
    }
    return { name, loopMode: options.sidecarLoopModes.get(name) ?? loopMode };
  });
}

/**
 * `_gen_unique_animation_name` (`gltf_document.cpp:475-495`): the name as `_sanitize_animation_name`
 * leaves it (`:470-473`), or the first of `name2`, `name3` and so on that no earlier clip took.
 */
function uniqueName(gltfName: string, takenNames: Set<string>): string {
  const sanitised = validateNodeName(gltfName).replace(/[/:,[]/g, '_');
  let name = sanitised;
  for (let index = 2; takenNames.has(name); index++) name = `${sanitised}${index}`;
  takenNames.add(name);
  return name;
}

/**
 * The glTF importer loops a clip whose lower-cased name begins or ends with loop or cycle
 * (`gltf_document.cpp:3750-3753`).
 */
function namesLoop(gltfName: string): boolean {
  const lower = gltfName.toLowerCase();
  return ['loop', 'cycle'].some((word) => lower.startsWith(word) || lower.endsWith(word));
}

/** The name without the trailing digits, control characters, spaces and `_` that Blender appends. */
function trimmedName(name: string): string {
  let end = name.length;
  while (end > 0 && isTrailingFiller(name.charCodeAt(end - 1))) end--;
  return name.slice(0, end);
}

function isTrailingFiller(code: number): boolean {
  const isDigit = code >= 0x30 && code <= 0x39;
  return isDigit || code <= 32 || code === 0x5f;
}

/**
 * `name` without the `marker` suffix, or null when it has none: `_teststr` and `_fixstr`
 * (`resource_importer_scene.cpp:403-445`). The trailing filler is tested without and kept after.
 */
function withoutMarker(name: string, marker: string): string | null {
  const what = trimmedName(name);
  const filler = name.slice(what.length);
  const lower = what.toLowerCase();
  // Detected case-insensitively but removed case-sensitively: `_fixstr` calls `String::replace`.
  if (lower.includes(`$${marker}`)) return what.replaceAll(`$${marker}`, '') + filler;
  if (lower.endsWith(`-${marker}`) || lower.endsWith(`_${marker}`)) {
    return what.slice(0, what.length - (marker.length + 1)) + filler;
  }
  return null;
}
