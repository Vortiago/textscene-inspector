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
 * `importNodeLayers` are the typed
 * readers, because `nodes/root_scale`, `nodes/apply_root_scale` and `_subresources`'
 * material remaps are the only parameters we honour; everything else is either something
 * three's GLTFLoader already does or a bake concern with no visual consequence.
 *
 * A foreign-format parser OUTSIDE the resource-slice registry (ADR-0031): a
 * sidecar is found by path convention beside its asset, never named by a
 * scene, so it claims no type name and no bus slot.
 */

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
  let pendingKey: string | null = null;
  let pending = '';
  let depth = 0;

  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim();

    // A `{`/`[` value spans lines until its brackets balance, so nothing inside it is
    // read as a section heading or a key of its own.
    if (pendingKey !== null) {
      pending += `\n${line}`;
      depth += bracketDepth(line);
      if (depth <= 0) {
        if (section === 'params') params[pendingKey] = pending;
        pendingKey = null;
        pending = '';
      }
      continue;
    }

    if (line === '' || line.startsWith(';')) continue;

    const heading = SECTION.exec(line);
    if (heading) {
      section = heading[1]!;
      sawSection = true;
      continue;
    }

    const pair = KEY_VALUE.exec(line);
    if (!pair) continue;
    const [, key, rawValue] = pair;
    const raw = rawValue!.trim();

    depth = bracketDepth(raw);
    if (depth > 0) {
      pendingKey = key!;
      pending = raw;
      continue;
    }

    const value = unquote(raw);
    if (section === 'params') params[key!] = value;
    else if (section === 'remap' && key === 'importer') importer = value;
  }

  return sawSection ? { importer, params } : null;
}

/** Net `{`/`[` nesting a line opens, ignoring bracket characters inside strings. */
function bracketDepth(line: string): number {
  let depth = 0;
  let inString = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (inString) {
      if (char === '\\') i++;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') inString = true;
    else if (char === '{' || char === '[') depth++;
    else if (char === '}' || char === ']') depth--;
  }
  return depth;
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

  return { scale, bake: parsed!.params['nodes/apply_root_scale'] !== 'false' };
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
 * One category of the `_subresources` dictionary. Godot writes it as a Variant, which is
 * JSON for the scalar-valued import options these categories hold — a category carrying
 * anything else is unreadable here and reads as absent, per this module's contract.
 */
function subResourceCategory(
  parsed: ParsedImportFile | null,
  category: string
): Record<string, unknown> | null {
  const raw = parsed?.params['_subresources'];
  if (raw === undefined) return null;
  try {
    const value = JSON.parse(raw) as Record<string, unknown>;
    const found = value[category];
    return typeof found === 'object' && found !== null ? (found as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}
