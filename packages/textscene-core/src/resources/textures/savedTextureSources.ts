/**
 * The resources a procedural texture names as saved files. A `GradientTexture2D` or a noise texture
 * reads its Gradient and FastNoiseLite from a `.tres` as it reads a sub-resource, so a loaded file
 * becomes a sub-resource of the table the texture sits in, and the texture's reference follows it.
 * The decoders and the procedural caches then see one form.
 */

import type { TscnExternalResource, TscnInternalResource } from '../../parser/types';
import { perObject } from '../../utils/perObject';
import { identityKey } from '../../utils/identityKey';
import type { ParsedResource } from '../../parser/parsedResource';
import { parsedResourcePath, findSubResource, parseResourceReference } from '../SubResourceResolver';
import type { LoadedFile } from '../scopedResource';

/** The properties of each procedural texture type that name a Gradient or a FastNoiseLite. */
const SOURCE_PROPERTIES: Readonly<Record<string, readonly string[]>> = {
  GradientTexture2D: ['gradient'],
  NoiseTexture2D: ['noise', 'color_ramp'],
  NoiseTexture3D: ['noise', 'color_ramp'],
};

/** The properties of the texture `ref` names that point at a saved file, with that file's path. */
function savedSources(
  ref: string | undefined,
  internalResources: readonly TscnInternalResource[],
  externalResources: readonly TscnExternalResource[]
): Array<{ resource: TscnInternalResource; property: string; path: string }> {
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
  internalResources: readonly TscnInternalResource[],
  externalResources: readonly TscnExternalResource[]
): string[] {
  return savedSources(ref, internalResources, externalResources).map(({ path }) => path);
}

/**
 * Written only by `withSavedSources`: the derived tables of each scene table, by texture and loaded
 * files. A table built once keeps its identity, which keys the procedural caches, so every holder of
 * one texture shares one raster. A reload parses a new file object, so a stale entry is never read.
 */
const derivedTables = perObject(
  (_table: readonly TscnInternalResource[]) => new Map<string, readonly TscnInternalResource[]>()
);

/**
 * `internalResources` with each loaded file the texture `ref` reads added as a sub-resource, and the
 * texture's properties pointing at it. The same table while no named file has loaded, and for a
 * texture that names none.
 */
export function withSavedSources(
  ref: string | undefined,
  internalResources: readonly TscnInternalResource[],
  externalResources: readonly TscnExternalResource[],
  loadedFile: LoadedFile
): readonly TscnInternalResource[] {
  const loaded = savedSources(ref, internalResources, externalResources).flatMap((source) => {
    const file = loadedFile(source.path);
    return file ? [{ ...source, file }] : [];
  });
  if (loaded.length === 0) return internalResources;

  const key = loaded
    .map(({ resource, property, path, file }) => `${resource.id}.${property}=${path}@${identityKey(file)}`)
    .join(' ');
  const derived = derivedTables(internalResources);
  if (!derived.has(key)) derived.set(key, inlineFiles(internalResources, loaded));
  return derived.get(key)!;
}

/** The sub-resource a loaded file becomes: its `[resource]`, under its path as the id. */
function fileResource(path: string, file: ParsedResource): TscnInternalResource {
  return { id: path, type: file.resourceType, data: file.properties };
}

function inlineFiles(
  internalResources: readonly TscnInternalResource[],
  loaded: ReadonlyArray<{
    resource: TscnInternalResource;
    property: string;
    path: string;
    file: ParsedResource;
  }>
): readonly TscnInternalResource[] {
  const added = new Map<string, TscnInternalResource>();
  const rewritten = new Map<TscnInternalResource, Record<string, string>>();
  for (const { resource, property, path, file } of loaded) {
    added.set(path, fileResource(path, file));
    rewritten.set(resource, {
      ...(rewritten.get(resource) ?? resource.data),
      [property]: `SubResource("${path}")`,
    });
  }
  return [
    ...internalResources.map((resource) =>
      rewritten.has(resource) ? { ...resource, data: rewritten.get(resource)! } : resource
    ),
    ...added.values(),
  ];
}
