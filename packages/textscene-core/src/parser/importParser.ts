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
import { boolSlotValue } from '../godot/index.js';

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
   * `nodes/root_scale`, `nodes/apply_root_scale`, and the `_subresources` material remaps and
   * mesh layers. The rest is GLTFLoader's work or a bake concern with no visual effect.
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
export function importRootScale(
  parsed: ParsedImportFile | null
): { scale: number; bake: boolean } | null {
  const raw = parsed?.params['nodes/root_scale'];
  if (raw === undefined) return null;

  const scale = Number(raw);
  // A zero or negative scale would collapse or mirror the asset; Godot's editor cannot
  // produce one, so treat it as corrupt and fall back to defaults rather than render it.
  if (!Number.isFinite(scale) || scale <= 0) return null;
  // An identity scale is the common case: null keeps the caller's hot path untouched.
  if (scale === 1) return null;

  // `bool apply_root = p_options["nodes/apply_root_scale"]`
  // (`resource_importer_scene.cpp:3154-3157`) booleanizes the Variant, so `0` is false.
  return { scale, bake: boolSlotValue(parsed!.params['nodes/apply_root_scale']) !== false };
}

/**
 * The sidecar's external-material remaps, from glTF material name to the `res://` `.tres`
 * that replaces it. Godot bakes them into the asset
 * (`editor/import/3d/resource_importer_scene.cpp:1620-1645`), so they belong to the GLB.
 * Godot tries the uid first (`:1625-1633`). Nothing here resolves `uid://`.
 */
export function importExternalMaterials(
  parsed: ParsedImportFile | null
): ReadonlyMap<string, string> {
  const remaps = new Map<string, string>();
  const materials = subResourceCategory(parsed, 'materials');
  if (!materials) return remaps;

  for (const [name, settings] of Object.entries(materials)) {
    if (typeof settings !== 'object' || settings === null) continue;
    const entry = settings as Record<string, unknown>;
    if (entry['use_external/enabled'] !== true) continue;

    const path = [entry['use_external/path'], entry['use_external/fallback_path']].find(
      (candidate): candidate is string =>
        typeof candidate === 'string' && candidate.startsWith('res://')
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
      logger.warn(
        '[ImportSidecar] _subresources is not readable as JSON; every override in it is ignored'
      );
    }
  }
  decodedSubResources.set(parsed, decoded);
  return decoded;
}
