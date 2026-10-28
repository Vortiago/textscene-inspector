/**
 * Whether Godot sets a ViewportTexture up for its scene. `make_local_resource` reads only the
 * property's own resource (`packed_scene.cpp:701-704`), and `configure_for_local_scene` recurses
 * only into sub-resources that are local to scene (`core/io/resource.cpp:497-503`), so every holder
 * between the node and the ViewportTexture must be local to scene. No THREE and no React.
 */

import type { TscnInternalResource } from '../../../parser/types.js';
import { boolSlotValue } from '../../../godot/variant/variantBool.js';
import {
  canvasTextureWrappers,
  resolveSubResourceRef,
  unwrapCanvasTextureRef,
} from '../../SubResourceResolver.js';
import type { AtlasTextureReference } from '../atlastexture/resolveAtlasTexture.js';
import { VIEWPORT_TEXTURE_TYPE } from './types.js';

/**
 * `resource_local_to_scene`, or its default: true for a ViewportTexture, whose constructor sets it
 * (`viewport.cpp:226-228`), false for any other resource.
 */
export function isLocalToScene(resource: TscnInternalResource): boolean {
  return boolSlotValue(resource.data.resource_local_to_scene) ?? resource.type === VIEWPORT_TEXTURE_TYPE;
}

/**
 * Every resource between the node property and the ViewportTexture it reaches, the ViewportTexture
 * included: the CanvasTextures around `ref`, a resource file's `[resource]` at `fileRef` in `tables`
 * and its wrappers, an AtlasTexture and the wrappers around its sheet.
 */
export function viewportTextureHolders(
  ref: string | undefined,
  internalResources: readonly TscnInternalResource[],
  fileRef: string | undefined,
  tables: readonly TscnInternalResource[],
  atlas: AtlasTextureReference | null,
  sourceRef: string | undefined
): TscnInternalResource[] {
  const isFile = tables !== internalResources;
  const resources = [
    ...canvasTextureWrappers(ref, internalResources),
    isFile ? resolveSubResourceRef(fileRef, tables) : undefined,
    ...(isFile ? canvasTextureWrappers(fileRef, tables) : []),
    atlas ? tables.find((resource) => resource.id === atlas.id) : undefined,
    ...(atlas ? canvasTextureWrappers(atlas.texture.atlas, tables) : []),
    resolveSubResourceRef(sourceRef, tables),
  ];
  return resources.filter((resource): resource is TscnInternalResource => resource !== undefined);
}

/**
 * The ViewportTexture a node's own slot reaches through its CanvasTextures, and whether Godot sets
 * it up there. Undefined for a slot that reaches none.
 */
export function inlineViewportTexture(
  ref: string | undefined,
  internalResources: readonly TscnInternalResource[]
): { resource: TscnInternalResource; isSetUp: boolean } | undefined {
  const sourceRef = unwrapCanvasTextureRef(ref, internalResources);
  const resource = resolveSubResourceRef(sourceRef, internalResources);
  if (resource?.type !== VIEWPORT_TEXTURE_TYPE) return undefined;
  const holders = viewportTextureHolders(
    ref,
    internalResources,
    sourceRef,
    internalResources,
    null,
    sourceRef
  );
  return { resource, isSetUp: holders.every(isLocalToScene) };
}
