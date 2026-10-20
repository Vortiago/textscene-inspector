/**
 * Parses Godot's `.import` sidecar, the importer and parameters of the asset beside it, which
 * `parseTresFile` rejects for want of a `[gd_resource]` header. A foreign-format parser outside
 * the resource-slice registry (ADR-0031): it is found by path convention, never named by a scene,
 * so it claims no type name and no bus slot.
 */

import {
  INITIAL_SCAN_STATE,
  isIncompleteState,
  scanValueChunk,
  unquoteLiteral,
  type ValueScanState,
} from './utils';
import * as logger from '../logger';
import { boolSlotValue } from '../godot/variant/variantBool.js';
import { DEFAULT_GLTF_NAMING_VERSION, type GltfNamingOptions } from '../godot/import/gltfImportNames.js';
import { parseOptionalFloat, parseOptionalInt } from './valueParsers.js';
import {
  DEFAULT_LIGHT_BAKE_MODE,
  DEFAULT_LIGHTMAP_TEXEL_SIZE,
  LightBakeMode,
  MeshOverride,
  unwrapTexelSize,
} from '../godot/import/sceneImport.js';
import {
  DEFAULT_TEXTURE_IMPORT,
  TEXTURE_COMPRESS_MODES,
  TEXTURE_IMPORTER,
  TextureNormalMapMode,
  roughnessLimitOption,
  type TextureImportOptions,
} from '../godot/import/textureImport.js';
import { AnimationLoopMode } from '../godot/scene/animation.js';
import type { ClipImportOptions } from '../godot/import/animationImport.js';
import {
  DEFAULT_SLICES,
  TEXTURE_2D_ARRAY_IMPORTER,
  TEXTURE_3D_IMPORTER,
  type ImportSlices,
} from '../godot/import/layeredTextureImport.js';

/** A `key=value` line, tolerating surrounding whitespace and a trailing comment-free tail. */
const KEY_VALUE = /^([A-Za-z_][A-Za-z0-9_/]*)=(.*)$/;
const SECTION = /^\[([A-Za-z_][A-Za-z0-9_]*)\]$/;

/**
 * Only `[params]` describes the import. `[remap]` and `[deps]` address the baked artifact under
 * `.godot/imported/`, which this previewer never reads (ADR-0028).
 */
export interface ParsedImportFile {
  /** The `[remap] importer=` value: `scene` for glTF/GLB, `wavefront_obj` for OBJ. */
  importer: string | null;
  /**
   * The `[params]` block: a string literal's decoded text, as `VariantParser` reads it back
   * (`resource_importer.cpp:76`), and any other value as written. The typed readers cover only
   * `nodes/root_scale`, `nodes/apply_root_scale`, the glTF naming options, the lightmap unwrap
   * options, `nodes/use_name_suffixes`, the `_subresources` material remaps, mesh layers, mesh
   * lightmap overrides and clip loop modes, a texture's compression and a 3D texture's slices.
   * The rest is GLTFLoader's work or a bake concern with no visual effect.
   */
  params: Record<string, string>;
}

/**
 * Parse a `.import` sidecar, or null when the text is not one.
 *
 * Null rather than a throw because absence and malformedness are both ordinary: most
 * assets have no sidecar, and a caller's only sensible response either way is "use
 * Godot's import defaults".
 */
export function parseImportFile(content: string): ParsedImportFile | null {
  let section: string | null = null;
  let importer: string | null = null;
  const params: Record<string, string> = {};
  let sawSection = false;
  let pending: { key: string; lines: string[]; scan: ValueScanState } | null = null;

  /** Commit whatever the open value has accumulated, balanced or salvaged. */
  const storePending = (): void => {
    if (pending && section === 'params') {
      params[pending.key] = unquoteLiteral(pending.lines.join('\n'));
    }
    pending = null;
  };

  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim();
    const heading = SECTION.exec(line);
    const pair = KEY_VALUE.exec(line);

    // A `{`/`[`/`"` value spans lines until it balances, so nothing inside it is read as
    // a key of its own. A section heading or a bare `key=` line means it never closed:
    // Godot quotes every key inside a Variant dictionary, so neither shape occurs inside
    // one. Salvaging on them stops one malformed value swallowing the keys after it.
    if (pending) {
      const open = pending;
      if (!heading && !pair) {
        open.lines.push(line);
        open.scan = scanValueChunk(line, open.scan);
        if (!isIncompleteState(open.scan)) storePending();
        continue;
      }
      storePending();
    }

    if (line === '' || line.startsWith(';')) continue;

    if (heading) {
      section = heading[1]!;
      sawSection = true;
      continue;
    }

    if (!pair) continue;
    const [, key, rawValue] = pair;
    const raw = rawValue!.trim();

    const scan = scanValueChunk(raw, INITIAL_SCAN_STATE);
    if (isIncompleteState(scan)) {
      pending = { key: key!, lines: [raw], scan };
      continue;
    }

    const value = unquoteLiteral(raw);
    if (section === 'params') params[key!] = value;
    else if (section === 'remap' && key === 'importer') importer = value;
  }
  storePending();

  return sawSection ? { importer, params } : null;
}

/**
 * How a sidecar's root scale applies, or null when it changes nothing. `bake` is
 * `nodes/apply_root_scale`: when true, Godot scales the meshes and leaves the root at 1,
 * so nodes a `.tscn` parents to the root are not scaled. When false, the root scales.
 */
export function importRootScale(parsed: ParsedImportFile | null): { scale: number; bake: boolean } | null {
  const raw = parsed?.params['nodes/root_scale'];
  if (raw === undefined) return null;

  const scale = parseOptionalFloat(raw);
  // A zero or negative scale would collapse or mirror the asset. Godot's editor cannot
  // produce one, so it reads as corrupt and falls back to the defaults.
  if (scale === undefined || scale <= 0) return null;
  // An identity scale is the common case: null keeps the caller's hot path untouched.
  if (scale === 1) return null;

  // `bool apply_root = p_options["nodes/apply_root_scale"]`
  // (`resource_importer_scene.cpp:3154-3157`) booleanizes the Variant, so `0` is false.
  return { scale, bake: boolSlotValue(parsed!.params['nodes/apply_root_scale']) !== false };
}

/**
 * The options a `texture` importer sidecar names that change the imported texture: its texels, its
 * format and its mip chain. A sidecar of another importer, or none, reads as the importer's
 * defaults, and so does a parameter it omits or cannot read.
 */
export function importTextureOptions(parsed: ParsedImportFile | null): TextureImportOptions {
  if (parsed?.importer !== TEXTURE_IMPORTER) return DEFAULT_TEXTURE_IMPORT;
  const { params } = parsed;
  const flag = (key: string, fallback: boolean): boolean => boolSlotValue(params[key]) ?? fallback;
  return {
    mode: compressMode(params['compress/mode']),
    highQuality: flag('compress/high_quality', DEFAULT_TEXTURE_IMPORT.highQuality),
    normalMap: parseOptionalInt(params['compress/normal_map']) === TextureNormalMapMode.Enable,
    mipmaps: flag('mipmaps/generate', DEFAULT_TEXTURE_IMPORT.mipmaps),
    fixAlphaBorder: flag('process/fix_alpha_border', DEFAULT_TEXTURE_IMPORT.fixAlphaBorder),
    premultAlpha: flag('process/premult_alpha', DEFAULT_TEXTURE_IMPORT.premultAlpha),
    invertNormalY: flag('process/normal_map_invert_y', DEFAULT_TEXTURE_IMPORT.invertNormalY),
    svgScale: parseOptionalFloat(params['svg/scale']) ?? DEFAULT_TEXTURE_IMPORT.svgScale,
    roughnessLimit: roughnessLimitOption(
      parseOptionalInt(params['roughness/mode']),
      params['roughness/src_normal']
    ),
  };
}

/** `compress/mode` by the number the sidecar stores, the default for one outside the enum. */
function compressMode(value: string | undefined): TextureImportOptions['mode'] {
  const index = parseOptionalInt(value);
  return (index === undefined ? undefined : TEXTURE_COMPRESS_MODES[index]) ?? DEFAULT_TEXTURE_IMPORT.mode;
}

/**
 * The slices of a sidecar that imports its image as a 3D texture, a count it omits at the
 * importer's default. Null for no sidecar or another importer, under which Godot imports no 3D
 * texture, and for a count under 1, which Godot divides by
 * (`resource_importer_layered_texture.cpp:372-373`).
 */
export function importTexture3DSlices(parsed: ParsedImportFile | null): ImportSlices | null {
  return layeredSlices(parsed, TEXTURE_3D_IMPORTER);
}

/** The slices a texture array's sidecar names, as {@link importTexture3DSlices} reads a 3D texture's. */
export function importTexture2DArraySlices(parsed: ParsedImportFile | null): ImportSlices | null {
  return layeredSlices(parsed, TEXTURE_2D_ARRAY_IMPORTER);
}

function layeredSlices(parsed: ParsedImportFile | null, importer: string): ImportSlices | null {
  if (parsed?.importer !== importer) return null;
  const horizontal = sliceCount(parsed.params['slices/horizontal']);
  const vertical = sliceCount(parsed.params['slices/vertical']);
  return horizontal >= 1 && vertical >= 1 ? { horizontal, vertical } : null;
}

/** Godot reads an unreadable count as the int 0, so it imports nothing rather than the default. */
function sliceCount(value: string | undefined): number {
  if (value === undefined) return DEFAULT_SLICES;
  return parseOptionalInt(value) ?? 0;
}

/**
 * The options that change the node names of an imported glTF, each at its default when the
 * sidecar is absent or omits it (`editor_scene_importer_gltf.cpp:47-58`).
 */
export function importGltfNaming(parsed: ParsedImportFile | null): Omit<GltfNamingOptions, 'fileName'> {
  const params = parsed?.params ?? {};
  return {
    namingVersion: parseOptionalInt(params['gltf/naming_version']) ?? DEFAULT_GLTF_NAMING_VERSION,
    importAsSkeletonBones: boolSlotValue(params['nodes/import_as_skeleton_bones']) === true,
  };
}

/**
 * The sidecar's external-material remaps, from glTF material name to the `res://` `.tres`
 * that replaces it. Godot bakes them into the asset
 * (`editor/import/3d/resource_importer_scene.cpp:1620-1645`), so they belong to the GLB.
 * Godot tries the uid first (`:1625-1633`). Nothing here resolves `uid://`.
 */
export function importExternalMaterials(parsed: ParsedImportFile | null): ReadonlyMap<string, string> {
  const remaps = new Map<string, string>();
  const materials = subResourceCategory(parsed, 'materials');
  if (!materials) return remaps;

  for (const [name, settings] of Object.entries(materials)) {
    if (typeof settings !== 'object' || settings === null) continue;
    const entry = settings as Record<string, unknown>;
    if (entry['use_external/enabled'] !== true) continue;

    const path = [entry['use_external/path'], entry['use_external/fallback_path']].find(
      (candidate): candidate is string => typeof candidate === 'string' && candidate.startsWith('res://')
    );
    if (path) remaps.set(name, path);
    // A remap with no `res://` path resolves only through Godot's uid table, so it is
    // announced, not dropped. The caller draws the glTF's own material.
    else logger.warn(`[ImportSidecar] material '${name}' remaps to no res:// path`);
  }
  return remaps;
}

/**
 * Per-node render-layer masks, keyed by the node path Godot writes as `PATH:a/b/c`.
 * `resource_importer_scene.cpp:1836` sets the mask on the imported mesh instance.
 */
export function importNodeLayers(parsed: ParsedImportFile | null): ReadonlyMap<string, number> {
  const masks = new Map<string, number>();
  const nodes = subResourceCategory(parsed, 'nodes');
  if (!nodes) return masks;

  for (const [key, settings] of Object.entries(nodes)) {
    if (typeof settings !== 'object' || settings === null) continue;
    const mask = (settings as Record<string, unknown>)['mesh_instance/layers'];
    if (typeof mask !== 'number' || !Number.isInteger(mask)) continue;
    masks.set(key.startsWith('PATH:') ? key.slice('PATH:'.length) : key, mask);
  }
  return masks;
}

/**
 * What the sidecar says about how Godot imports a glTF's clips: whether it strips loop suffixes
 * from their names (`nodes/use_name_suffixes`, `resource_importer_scene.cpp:640-645`), and each
 * `_subresources.animations` entry's `settings/loop_mode` (`:1308`, `:1335-1347`).
 */
export function importClipOptions(parsed: ParsedImportFile | null): ClipImportOptions {
  const sidecarLoopModes = new Map<string, number>();
  for (const [name, settings] of Object.entries(subResourceCategory(parsed, 'animations') ?? {})) {
    if (typeof settings !== 'object' || settings === null) continue;
    // A missing or unreadable key reads as the option's default, 0 (`:2187`).
    const mode = (settings as Record<string, unknown>)['settings/loop_mode'];
    sidecarLoopModes.set(name, typeof mode === 'number' ? Math.trunc(mode) : AnimationLoopMode.NONE);
  }
  return {
    useNameSuffixes: boolSlotValue(parsed?.params['nodes/use_name_suffixes']) ?? true,
    sidecarLoopModes,
  };
}

/** Which meshes of an asset Godot's importer unwraps for lightmaps, and at what texel size. */
export interface LightmapUnwrap {
  texelSize: number;
  /** Whether the mesh of this import id, `<scene>_<mesh>` for a glTF, is unwrapped. */
  unwraps(meshId: string): boolean;
}

/**
 * The asset's lightmap unwrap, or null when no mesh can be unwrapped. A mesh is unwrapped at
 * `meshes/light_baking` Static Lightmaps, and its `_subresources` `generate/lightmap_uv`
 * overrides that either way (`resource_importer_scene.cpp:2622`, `:2649-2655`).
 */
export function importLightmapUnwrap(parsed: ParsedImportFile | null): LightmapUnwrap | null {
  if (!parsed) return null;
  const overrides = meshLightmapOverrides(parsed);
  const bakesAll =
    (parseOptionalInt(parsed.params['meshes/light_baking']) ?? DEFAULT_LIGHT_BAKE_MODE) ===
    LightBakeMode.StaticLightmaps;
  if (!bakesAll && ![...overrides.values()].includes(MeshOverride.Enable)) return null;

  const texelOption =
    parseOptionalFloat(parsed.params['meshes/lightmap_texel_size']) ?? DEFAULT_LIGHTMAP_TEXEL_SIZE;
  return {
    texelSize: unwrapTexelSize(texelOption),
    unwraps: (meshId) => {
      const override = overrides.get(meshId);
      if (override === MeshOverride.Enable) return true;
      if (override === MeshOverride.Disable) return false;
      return bakesAll;
    },
  };
}

/** Each mesh's `generate/lightmap_uv`, by import id. */
function meshLightmapOverrides(parsed: ParsedImportFile): ReadonlyMap<string, number> {
  const overrides = new Map<string, number>();
  for (const [meshId, settings] of Object.entries(subResourceCategory(parsed, 'meshes') ?? {})) {
    if (typeof settings !== 'object' || settings === null) continue;
    const override = (settings as Record<string, unknown>)['generate/lightmap_uv'];
    if (typeof override === 'number') overrides.set(meshId, override);
  }
  return overrides;
}

/**
 * The decoded `_subresources` dictionary, memoised per parse: both typed readers ask for
 * a category of the same blob, and a sidecar's animation slices can run to hundreds of KB.
 */
const decodedSubResources = new WeakMap<ParsedImportFile, Record<string, unknown> | null>();

/**
 * One category of `_subresources`. Godot writes it as one Variant, JSON for these scalar
 * options, so one value JSON cannot read (`Vector3(…)`, `&"…"`, `inf`) loses every
 * category. That divergence is warned about once per parse.
 */
function subResourceCategory(
  parsed: ParsedImportFile | null,
  category: string
): Record<string, unknown> | null {
  if (!parsed) return null;
  const found = decodeSubResources(parsed)?.[category];
  return typeof found === 'object' && found !== null ? (found as Record<string, unknown>) : null;
}

function decodeSubResources(parsed: ParsedImportFile): Record<string, unknown> | null {
  const memo = decodedSubResources.get(parsed);
  if (memo !== undefined) return memo;

  const raw = parsed.params['_subresources'];
  let decoded: Record<string, unknown> | null = null;
  if (raw !== undefined) {
    try {
      decoded = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      logger.warn('[ImportSidecar] _subresources is not readable as JSON; every override in it is ignored');
    }
  }
  decodedSubResources.set(parsed, decoded);
  return decoded;
}
