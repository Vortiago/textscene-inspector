/**
 * Determine whether a TscnNode depends on (transitively references) a given
 * external resource path. Used by handleResourceLoaded / provideResource to
 * avoid re-rendering nodes that cannot have been affected by the loaded path.
 *
 * Walks references for properties known to point at meshes/materials/textures:
 *   - `mesh` (SubResource or ExtResource)
 *   - `materialOverride`, `materialOverlay` (SubResource or ExtResource)
 *   - `surfaceMaterialOverrides[N]` (SubResource or ExtResource)
 *
 * Inside a SubResource, the following references are followed:
 *   - Mesh SubResource: its `material` field
 *   - Material SubResource: any `*_texture` field
 *
 * This is intentionally tactical; a reverse-dependency index built during
 * scene resolution would be cleaner but is significantly more invasive.
 */
import type { TscnNode, TscnScene, SubResource } from '../parser/types';
import type { MeshInstance3DProperties } from '../nodes/3d/meshinstance3d/types';

const SUB_RESOURCE_RE = /^SubResource\s*\(\s*"([^"]+)"\s*\)$/;
const EXT_RESOURCE_RE = /^ExtResource\s*\(\s*"([^"]+)"\s*\)$/;

function parseRef(value: unknown): { type: 'SubResource' | 'ExtResource'; id: string } | null {
  if (typeof value !== 'string') {
    return null;
  }
  const sub = value.match(SUB_RESOURCE_RE);
  if (sub && sub[1]) {
    return { type: 'SubResource', id: sub[1] };
  }
  const ext = value.match(EXT_RESOURCE_RE);
  if (ext && ext[1]) {
    return { type: 'ExtResource', id: ext[1] };
  }
  return null;
}

function findSubResource(scene: TscnScene, id: string): SubResource | undefined {
  return scene.internalResources.find((r) => {
    const resourceId = r.data.id as string | undefined;
    return resourceId === id || String(r.id) === id;
  });
}

function extResourceMatches(scene: TscnScene, id: string, path: string): boolean {
  const meta = scene.resourceLoader?.getMetadata(id);
  return meta?.path === path;
}

/**
 * Returns true if the SubResource (or any resource it references) ultimately
 * points at `path`. Cycle-safe via `visited`.
 */
function subResourceRefersTo(
  scene: TscnScene,
  subId: string,
  path: string,
  visited: Set<string>,
): boolean {
  if (visited.has(subId)) {
    return false;
  }
  visited.add(subId);

  const sub = findSubResource(scene, subId);
  if (!sub) {
    return false;
  }

  for (const [key, value] of Object.entries(sub.data)) {
    if (key === 'id') continue;
    if (refResolvesTo(scene, value, path, visited, key)) {
      return true;
    }
  }
  return false;
}

/**
 * Returns true if `value` (possibly a resource reference) resolves to `path`.
 * `propertyName` lets callers limit recursion to fields that can actually
 * contain resource references — but since we only recurse via parseRef which
 * already filters non-reference values, it is informational only.
 */
function refResolvesTo(
  scene: TscnScene,
  value: unknown,
  path: string,
  visited: Set<string>,
  _propertyName?: string,
): boolean {
  const ref = parseRef(value);
  if (!ref) {
    return false;
  }
  if (ref.type === 'ExtResource') {
    return extResourceMatches(scene, ref.id, path);
  }
  // SubResource — recurse into its data
  return subResourceRefersTo(scene, ref.id, path, visited);
}

/**
 * Returns true if `node` (assumed MeshInstance3D) depends on `path`.
 * For other node types this returns false; callers should only invoke it for
 * nodes whose renderer can react to texture/material/mesh resource changes.
 */
export function nodeDependsOnPath(node: TscnNode, path: string, scene: TscnScene): boolean {
  if (node.type !== 'MeshInstance3D') {
    return false;
  }

  const visited = new Set<string>();
  const props = node.properties as MeshInstance3DProperties;

  if (props.mesh && refResolvesTo(scene, props.mesh, path, visited, 'mesh')) {
    return true;
  }
  if (props.materialOverride && refResolvesTo(scene, props.materialOverride, path, visited, 'materialOverride')) {
    return true;
  }
  if (props.materialOverlay && refResolvesTo(scene, props.materialOverlay, path, visited, 'materialOverlay')) {
    return true;
  }
  if (props.surfaceMaterialOverrides) {
    const overrides = props.surfaceMaterialOverrides;
    const entries: Iterable<[number, string]> = overrides instanceof Map
      ? overrides
      : (Object.entries(overrides) as unknown as Iterable<[number, string]>);
    for (const [, ref] of entries) {
      if (refResolvesTo(scene, ref, path, visited, 'surfaceMaterialOverride')) {
        return true;
      }
    }
  }

  return false;
}
