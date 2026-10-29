/**
 * The resources a procedural texture names as saved files. A `GradientTexture2D` or a noise texture
 * reads its Gradient and FastNoiseLite from a `.tres` as it reads a sub-resource, so a loaded file
 * becomes a sub-resource of the table the texture sits in, and the texture's reference follows it.
 * The decoders and the procedural caches then see one form.
 */

import type { TscnExternalResource, TscnInternalResource } from '../../parser/types';
import { perObject } from '../../utils/perObject';
import type { ParsedResource } from '../../parser/parsedResource';
import { findSectionResource } from '../resourceSection';
import { parsedResourcePath, findSubResource, parseResourceReference } from '../SubResourceResolver';
import type { LoadedFile } from '../scopedResource';

/** The properties of each procedural texture type that name a Gradient or a FastNoiseLite. */
const SOURCE_PROPERTIES: Readonly<Record<string, readonly string[]>> = {
  GradientTexture2D: ['gradient'],
  NoiseTexture2D: ['noise', 'color_ramp'],
  NoiseTexture3D: ['noise', 'color_ramp'],
};

interface SavedSource {
  resource: TscnInternalResource;
  property: string;
  path: string;
}

interface LoadedSource extends SavedSource {
  file: ParsedResource;
}

/** The properties of the texture `ref` names that point at a saved file, with that file's path. */
function savedSources(
  ref: string | undefined,
  externalResources: readonly TscnExternalResource[],
  internalResources: readonly TscnInternalResource[]
): SavedSource[] {
  const parsed = parseResourceReference(ref ?? '');
  const resource = parsed?.type === 'SubResource' ? findSubResource(internalResources, parsed.id) : undefined;
  if (!resource) return [];
  return (SOURCE_PROPERTIES[resource.type] ?? []).flatMap((property) => {
    const path = parsedResourcePath(resource.data[property], externalResources);
    return path ? [{ resource, property, path }] : [];
  });
}

/** The files the texture `ref` names reads its sources from. */
export function savedSourcePaths(
  ref: string | undefined,
  externalResources: readonly TscnExternalResource[],
  internalResources: readonly TscnInternalResource[]
): string[] {
  return savedSources(ref, externalResources, internalResources).map(({ path }) => path);
}

interface DerivedTable {
  /** The file each source had when the table was built, undefined for one not loaded. */
  files: ReadonlyArray<ParsedResource | undefined>;
  table: readonly TscnInternalResource[];
}

/**
 * Written only by `withSavedSources`: the derived table of each scene table, by texture property.
 * A table built once keeps its identity, which keys the procedural caches, so every holder of one
 * texture shares one raster. A reload replaces the entry, so one entry stays per property.
 */
const derivedTables = perObject(() => new Map<string, DerivedTable>());

/**
 * `internalResources` with each loaded file the texture `ref` reads added as a sub-resource, and the
 * texture's properties pointing at it. The same table while no named file has loaded, and for a
 * texture that names none.
 */
export function withSavedSources(
  ref: string | undefined,
  externalResources: readonly TscnExternalResource[],
  internalResources: readonly TscnInternalResource[],
  loadedFile: LoadedFile
): readonly TscnInternalResource[] {
  const sources = savedSources(ref, externalResources, internalResources);
  const files = sources.map(({ path }) => loadedFile(path));
  const loaded = sources.flatMap((source, index) => {
    const file = files[index];
    return file ? [{ ...source, file }] : [];
  });
  if (loaded.length === 0) return internalResources;

  // The key names every source, loaded or not, so one entry stays per texture.
  const key = sources.map(({ resource, property, path }) => `${resource.id}.${property}=${path}`).join(' ');
  const derived = derivedTables(internalResources);
  const held = derived.get(key);
  if (held && held.files.every((file, index) => file === files[index])) return held.table;

  const table = inlineFiles(internalResources, loaded);
  derived.set(key, { files, table });
  return table;
}

/** The id a saved file takes in the table: the prefix keeps it from meeting a scene's own id. */
function savedId(path: string): string {
  return `saved:${path}`;
}

/** Dedupes by path: `gradient` and `color_ramp` may name one file. */
function inlineFiles(
  internalResources: readonly TscnInternalResource[],
  loaded: readonly LoadedSource[]
): readonly TscnInternalResource[] {
  const added = new Map<string, TscnInternalResource>();
  const rewritten = new Map<TscnInternalResource, Record<string, string>>();
  for (const { resource, property, path, file } of loaded) {
    const section = findSectionResource(file, path);
    // An undeclared sub-resource leaves the reference unresolved, as an unloaded file does.
    if (!section) continue;
    added.set(path, { ...section, id: savedId(path) });
    rewritten.set(resource, {
      ...(rewritten.get(resource) ?? resource.data),
      [property]: `SubResource("${savedId(path)}")`,
    });
  }
  return [
    ...internalResources.map((resource) => {
      const data = rewritten.get(resource);
      return data ? { ...resource, data } : resource;
    }),
    ...added.values(),
  ];
}
