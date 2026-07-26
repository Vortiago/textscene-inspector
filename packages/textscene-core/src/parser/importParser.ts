/**
 * Godot `.import` sidecar parsing — the file Godot writes beside a source asset
 * recording which importer produced it and with what parameters.
 *
 * A sidecar is NOT a `.tres`: it has no `[gd_resource]` header, so `parseTresFile`
 * rejects it. It is a plain INI of `[section]` blocks and `key=value` lines, and only
 * `[params]` describes the import — `[remap]` and `[deps]` address the baked artifact
 * under `.godot/imported/`, which this previewer never reads (ADR-0028).
 *
 * Values stay raw strings. `importRootScale` is the only typed reader, because
 * `nodes/root_scale` and `nodes/apply_root_scale` are the only parameters we honour;
 * everything else is either something three's GLTFLoader already does or a bake concern
 * with no visual consequence in a preview.
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

  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim();
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
    const value = unquote(rawValue!.trim());

    if (section === 'params') params[key!] = value;
    else if (section === 'remap' && key === 'importer') importer = value;
  }

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

  return { scale, bake: parsed!.params['nodes/apply_root_scale'] !== 'false' };
}
