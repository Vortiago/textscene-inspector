/**
 * The skin a MeshInstance3D draws with: the Skin it sets through `skin`, else the automatic skin of
 * the Skeleton3D it names (`MeshInstance3D::_resolve_skeleton_path`, `mesh_instance_3d.cpp:175-199`).
 */

import { useMemo } from 'react';
import { useSceneResources } from '../../../r3f/SceneResourcesContext';
import { useLiveScenePass } from '../../../r3f/liveScenePass';
import { decodeSkin } from '../../../resources/skin';
import { useResourceResolution } from '../../../resources/useSubOrExtResource';
import { bindMeshesToSkeletons, namesSkeletonToBind, type BoundSkin } from '../skeleton3d/skeletonBindings';
import type { MeshInstance3DProperties } from './types';

/**
 * Undefined while the node binds no skeleton, and while a Skin it sets is still loading. A Skin that
 * never loads, or a resource that is not a Skin, leaves `skin` null in Godot, so the automatic skin binds.
 *
 * @param bindingPath the live path of the node, or null where it cannot bind, which watches no load
 */
export function useMeshSkin(
  properties: MeshInstance3DProperties,
  bindingPath: string | null
): BoundSkin | undefined {
  const pools = useSceneResources();
  const automatic = useLiveScenePass(
    bindMeshesToSkeletons,
    namesSkeletonToBind(properties) ? bindingPath : null
  );
  const { scoped, status } = useResourceResolution(properties.skin, pools);
  const skinResource = scoped?.resource.type === 'Skin' ? scoped.resource : null;
  const binds = useMemo(() => (skinResource ? decodeSkin(skinResource.data) : null), [skinResource]);
  return useMemo(() => {
    if (binds) return automatic?.withSkin(binds);
    return status === 'pending' ? undefined : automatic;
  }, [automatic, binds, status]);
}
