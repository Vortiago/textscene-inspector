/**
 * Re-home an override's resource references into the scope of the node it overrides.
 * Godot resolves each property in the file that wrote it (`resource_format_text.cpp:125-151`),
 * but a component resolves all of a node's properties in one scope. So each resource the
 * override names joins the node's scope, under a fresh id where the node's file holds that id.
 */

import { renameResourceRefs, type ResourceRef } from '../godot/resourceRef.js';
import type { SceneScope, TscnExternalResource, TscnInternalResource } from '../parser/types.js';
import { findExtResource, findSubResource } from './SubResourceResolver.js';

export interface RehomedOverride {
  /** The override's raw properties, each reference renamed to its id in `scope`. */
  raw: Record<string, string>;
  /** The node's scope with every resource the override reaches added. */
  scope: SceneScope;
}

/** Appended to an id the target scope already holds, until the id is free. */
const COLLISION_SUFFIX = ' (outer)';

/**
 * `raw`, authored against `from`, rewritten to resolve against the returned scope, which is
 * `into` plus the resources `raw` reaches in `from`, its SubResources' own references included.
 * An id `from` lacks resolves to nothing, as Godot's loader gives it nothing.
 */
export function rehomeOverride(
  raw: Record<string, string>,
  from: SceneScope,
  into: SceneScope
): RehomedOverride {
  const external = new IdPool(into.externalResources);
  const internal = new IdPool(into.internalResources);
  const addedExternal: TscnExternalResource[] = [];
  const addedInternal: TscnInternalResource[] = [];

  const rehomeRef = (ref: ResourceRef): string => {
    const pool = ref.kind === 'ExtResource' ? external : internal;
    const known = pool.renamed.get(ref.id);
    if (known !== undefined) return known;
    const id = pool.claim(ref.id);
    if (ref.kind === 'ExtResource') {
      const resource = findExtResource(from.externalResources, ref.id);
      if (resource) addedExternal.push({ ...resource, id });
    } else {
      const resource = findSubResource(from.internalResources, ref.id);
      // Pushed before its data is rehomed: a SubResource it reaches takes its own id first.
      if (resource) addedInternal.push({ ...resource, id, data: mapValues(resource.data, rehomeValue) });
    }
    return id;
  };
  const rehomeValue = (value: string): string => renameResourceRefs(value, rehomeRef);

  const rehomedRaw = mapValues(raw, rehomeValue);
  if (external.renamed.size === 0 && internal.renamed.size === 0) return { raw, scope: into };
  return {
    raw: rehomedRaw,
    scope: {
      ...into,
      externalResources: [...into.externalResources, ...addedExternal],
      internalResources: [...into.internalResources, ...addedInternal],
    },
  };
}

/** The ids one kind of resource holds in the target scope, and the ones the override claimed. */
class IdPool {
  /** Built on the first claim: most overrides name no resource. */
  private taken: Set<string> | undefined;
  /** Each id the override named, mapped to the id it holds in the target scope. */
  readonly renamed = new Map<string, string>();

  constructor(private readonly resources: readonly { id: string }[]) {}

  /** A free id for `id`: `id` itself unless the target scope holds it. */
  claim(id: string): string {
    this.taken ??= new Set(this.resources.map((r) => r.id));
    let free = id;
    while (this.taken.has(free)) free += COLLISION_SUFFIX;
    this.taken.add(free);
    this.renamed.set(id, free);
    return free;
  }
}

function mapValues(record: Record<string, string>, map: (value: string) => string): Record<string, string> {
  return Object.fromEntries(Object.entries(record).map(([key, value]) => [key, map(value)]));
}
