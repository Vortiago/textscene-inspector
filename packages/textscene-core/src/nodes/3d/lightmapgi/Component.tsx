/**
 * <LightmapGI>: hands its baked data to the scene's lightmaps (`r3f/lightmap/sceneLightmaps.ts`),
 * which light each node the data names from the bake's atlas. It draws nothing of its own.
 */

import { useThree } from '@react-three/fiber';
import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import type * as THREE from 'three';
import { projectUsesLightmapBicubicFilter } from '../../../parser/projectSettingsParser';
import { combinedLightmapAtlas } from '../../../resources/lightmapgidata/build';
import { decodeLightmapGIData } from '../../../resources/lightmapgidata/decode';
import type { LightmapGIData } from '../../../resources/lightmapgidata/types';
import { useResource } from '../../../resources/useResource';
import { useSubOrExtResource } from '../../../resources/useSubOrExtResource';
import { useNodePath } from '../../../r3f/contexts/NodePathContext';
import { useProjectSettings } from '../../../r3f/contexts/ProjectSettingsContext';
import { useTreeOrder } from '../../../r3f/contexts/TreeOrderContext';
import { assignedUsers, LightmapInstance, lightmapsOf } from '../../../r3f/lightmap/sceneLightmaps';
import type { NodeComponentProps } from '../../../r3f/NodeComponentRegistry';
import { useSceneResources } from '../../../r3f/SceneResourcesContext';
import { useUniqueNamePaths } from '../../../r3f/useUniqueNames';
import { Node3D } from '../../base/node3d/Component';
import type { LightmapGIProperties } from './types';

export function LightmapGI({ node, children }: NodeComponentProps) {
  const { lightData } = node.properties as LightmapGIProperties;
  const scoped = useSubOrExtResource(lightData, useSceneResources());
  const data = useMemo(
    () =>
      scoped?.resource.type === 'LightmapGIData'
        ? decodeLightmapGIData(scoped.resource.data, scoped.resources.externalResources)
        : null,
    [scoped]
  );
  return (
    <Node3D node={node}>
      {data && <BakedLightmap data={data} />}
      {children}
    </Node3D>
  );
}

/** The LightmapGI's place in the scene graph, and its data in the scene's lightmaps while mounted. */
function BakedLightmap({ data }: { data: LightmapGIData }) {
  const scene = useThree((state) => state.scene);
  const invalidate = useThree((state) => state.invalidate);
  const path = useNodePath();
  const uniquePaths = useUniqueNamePaths(path);
  const order = useTreeOrder();
  const usesBicubicFilter = projectUsesLightmapBicubicFilter(useProjectSettings().settings);
  const [loaded, setLoaded] = useState<ReadonlyMap<string, THREE.DataArrayTexture>>(new Map());
  const atlas = useAtlas(data.lightmapTextures, loaded);
  const [object, setObject] = useState<THREE.Object3D | null>(null);
  const instance = useMemo(() => object && new LightmapInstance(object), [object]);

  useLayoutEffect(() => (instance ? lightmapsOf(scene).add(instance) : undefined), [scene, instance]);
  useLayoutEffect(() => {
    if (!instance) return;
    instance.order = order;
    instance.users = path === null ? new Map() : assignedUsers(path, data.users, uniquePaths);
    instance.atlas = atlas;
    instance.usesSphericalHarmonics = data.usesSphericalHarmonics;
    instance.usesBicubicFilter = usesBicubicFilter;
    instance.bounds = data.bounds;
    lightmapsOf(scene).changed();
    invalidate();
  }, [scene, invalidate, instance, order, path, uniquePaths, data, atlas, usesBicubicFilter]);

  const report = useCallback((texturePath: string, texture: THREE.DataArrayTexture | undefined) => {
    setLoaded((current) => withTexture(current, texturePath, texture));
  }, []);
  return (
    <object3D ref={setObject}>
      {data.lightmapTextures.map((texturePath) => (
        <LightmapTextureLoad key={texturePath} path={texturePath} report={report} />
      ))}
    </object3D>
  );
}

/** Loads one lightmap texture and reports it, or its absence, to the LightmapGI. */
function LightmapTextureLoad({
  path,
  report,
}: {
  path: string;
  report: (path: string, texture: THREE.DataArrayTexture | undefined) => void;
}) {
  const { value } = useResource<THREE.DataArrayTexture>(path, 'texture2darray');
  useLayoutEffect(() => {
    report(path, value);
    return () => report(path, undefined);
  }, [path, value, report]);
  return null;
}

function withTexture(
  loaded: ReadonlyMap<string, THREE.DataArrayTexture>,
  path: string,
  texture: THREE.DataArrayTexture | undefined
): ReadonlyMap<string, THREE.DataArrayTexture> {
  if (loaded.get(path) === texture) return loaded;
  const next = new Map(loaded);
  if (texture) next.set(path, texture);
  else next.delete(path);
  return next;
}

/** The atlas of the textures at `paths`, null until every one has loaded. */
function useAtlas(
  paths: readonly string[],
  loaded: ReadonlyMap<string, THREE.DataArrayTexture>
): THREE.DataArrayTexture | null {
  const textures = useMemo(() => paths.flatMap((path) => loaded.get(path) ?? []), [paths, loaded]);
  const atlas = useMemo(
    () => (textures.length === paths.length ? combinedLightmapAtlas(textures) : null),
    [textures, paths]
  );
  // A stacked atlas is this component's own. A lone texture is the loader's.
  useEffect(
    () => () => {
      if (atlas && !textures.includes(atlas)) atlas.dispose();
    },
    [atlas, textures]
  );
  return atlas;
}
