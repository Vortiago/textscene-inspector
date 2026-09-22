/**
 * Godot `.import` sidecar parsing — the file Godot writes beside a source asset
 * recording which importer produced it and with what parameters.
 *
 * A sidecar is NOT a `.tres`: it has no `[gd_resource]` header, so `parseTresFile`
 * rejects it. It is a plain INI of `[section]` blocks and `key=value` lines, and only
 * `[params]` describes the import — `[remap]` and `[deps]` address the baked artifact
 * under `.godot/imported/`, which this previewer never reads (ADR-0028).
 *
 * Values stay raw strings; `importRootScale`, `importExternalMaterials` and
 * `importNodeLayers` are the typed readers, because `nodes/root_scale`,
 * `nodes/apply_root_scale` and, from `_subresources`, the per-material `use_external`
 * remaps and per-node `mesh_instance/layers` are the only parameters we honour;
 * everything else is either something three's GLTFLoader already does or a bake concern
 * with no visual consequence.
 *
 * A foreign-format parser OUTSIDE the resource-slice registry (ADR-0031): a
 * sidecar is found by path convention beside its asset, never named by a
 * scene, so it claims no type name and no bus slot.
 */

import {
  INITIAL_SCAN_STATE,
  isIncompleteState,
  scanValueChunk,
  type ValueScanState,
} from './utils';
import * as logger from '../logger';
import { boolSlotValue } from '../godot/index.js';

/** A `key=value` line, tolerating surrounding whitespace and a trailing comment-free tail. */
const KEY_VALUE = /^([A-Za-z_][A-Za-z0-9_/]*)=(.*)$/;
const SECTION = /^\[([A-Za-z_][A-Za-z0-9_]*)\]$/;

export interface ParsedImportFile {
  /** The `[remap] importer=` value: `scene` for glTF/GLB, `wavefront_obj` for OBJ. */
  importer: string | null;
  /** The `[params]` block, raw value strings. */
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
    if (pending && section === 'params') params[pending.key] = unquote(pending.lines.join('\n'));
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

    const value = unquote(raw);
    if (section === 'params') params[key!] = value;
    else if (section === 'remap' && key === 'importer') importer = value;
  }
  storePending();

  return sawSection ? { importer, params } : null;
}

/** Godot writes strings quoted; every other value form is left verbatim. */
function unquote(value: string): string {
  return value.length >= 2 && value.startsWith('"') && value.endsWith('"')
    ? value.slice(1, -1)
    : value;
}

/**
 * How a sidecar's root scale should be applied, or null when it changes nothing.
 *
 * `bake` is Godot's `nodes/apply_root_scale`, and it is not cosmetic. When true Godot
 * applies the scale to the MESHES and leaves the root node at scale 1, so nodes a
 * `.tscn` parents to the instanced root are NOT scaled, since those are authored against
 * the final size. When false the scale multiplies the root node instead, and does carry
 * to such children.
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
  // An identity scale is the overwhelmingly common case and means there is nothing to
  // do — returning null keeps the caller's hot path untouched.
  if (scale === 1) return null;

  // `bool apply_root = p_options["nodes/apply_root_scale"]`
  // (`resource_importer_scene.cpp:3154-3157`) booleanizes the Variant, so `0` is false.
  return { scale, bake: boolSlotValue(parsed!.params['nodes/apply_root_scale']) !== false };
}

/**
 * The sidecar's per-material **external material** remaps: glTF material name → the
 * `res://` `.tres` that replaces it.
 *
 * Godot bakes this into the imported asset itself
 * (`editor/import/3d/resource_importer_scene.cpp:1620-1645`), which is why it belongs to
 * the GLB template rather than to any scene instancing it. The uid form is tried first
 * and the `res://` fallback second (`:1625-1633`); nothing here resolves `uid://`, so the
 * fallback is what a remap resolves to in practice.
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
    // A remap with no `res://` path is a divergence Godot resolves through its uid table
    // and we cannot, so it is announced rather than dropped — the caller draws the glTF's
    // own material.
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
 * One category of the `_subresources` dictionary. Godot writes the whole thing as a
 * single Variant, which is JSON for the scalar-valued import options these categories
 * hold — so the failure unit is the DICTIONARY, not the category: one value JSON cannot
 * read (`Vector3(…)`, `&"…"`, `inf`) takes every category with it. That is a divergence
 * we would otherwise render silently, so it is warned about once per parse.
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
