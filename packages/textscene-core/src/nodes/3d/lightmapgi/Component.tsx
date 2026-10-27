/**
 * <LightmapGI>: hands its baked data to the scene's lightmaps (`r3f/lightmap/sceneLightmaps.ts`),
 * which light each node the data names from the bake's atlas, and shadow each sun from its
 * shadowmask. It draws nothing of its own.
 */

import { useThree } from '@react-three/fiber';
import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import type * as THREE from 'three';
import { LIGHTMAP_SH_LAYERS_PER_SLICE, ShadowmaskMode } from '../../../godot/scene/lightmapGi';
import { projectUsesLightmapBicubicFilter } from '../../../parser/projectSettingsParser';
import { atlasWithShadowmask, combinedAtlas } from '../../../resources/lightmapgidata/build';
import { decodeLightmapGIData } from '../../../resources/lightmapgidata/decode';
import type { LightmapGIData } from '../../../resources/lightmapgidata/types';
import { useResource } from '../../../resources/useResource';
import { useSubOrExtResource } from '../../../resources/useSubOrExtResource';
import { useNodePath } from '../../../r3f/contexts/NodePathContext';
import { useOptionalExposureFactor } from '../../../r3f/environment/worldExposure';
import { exposureOverBaked } from '../../../r3f/exposure/exposureOverBaked';
import { useProjectSettings } from '../../../r3f/contexts/ProjectSettingsContext';
import { useTreeOrder } from '../../../r3f/contexts/TreeOrderContext';
import { assignedUsers, LightmapInstance, lightmapsOf } from '../../../r3f/lightmap/sceneLightmaps';
import type { NodeComponentProps } from '../../../r3f/NodeComponentRegistry';
import { useSceneResources } from '../../../r3f/SceneResourcesContext';
import { useUniqueNamePaths } from '../../../r3f/useUniqueNames';
import { Node3D } from '../../base/node3d/Component';
import type { LightmapGIProperties } from './types';

const NO_PATHS: readonly string[] = [];

export function LightmapGI({ node, children }: NodeComponentProps) {
  const { lightData, shadowmaskMode } = node.properties as LightmapGIProperties;
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
      {data && <BakedLightmap data={data} shadowmaskMode={shadowmaskMode} />}
      {children}
    </Node3D>
  );
}

/** The LightmapGI's place in the scene graph, and its data in the scene's lightmaps while mounted. */
function BakedLightmap({
  data,
  shadowmaskMode,
}: {
  data: LightmapGIData;
  shadowmaskMode: LightmapGIProperties['shadowmaskMode'];
}) {
  const scene = useThree((state) => state.scene);
  const invalidate = useThree((state) => state.invalidate);
  const path = useNodePath();
  const uniquePaths = useUniqueNamePaths(path);
  const order = useTreeOrder();
  const usesBicubicFilter = projectUsesLightmapBicubicFilter(useProjectSettings().settings);
  const exposureScale = exposureOverBaked(useOptionalExposureFactor(), data.bakedExposure);
  const lightmapLoads = useLoadedTextures();
  const shadowmaskLoads = useLoadedTextures();
  const lightmapAtlas = useAtlas(data.lightmapTextures, lightmapLoads.loaded);
  // A bake with mode None never reads its shadowmask, so it loads, copies and uploads none.
  const shadowmaskPaths = shadowmaskMode === ShadowmaskMode.NONE ? NO_PATHS : data.shadowmaskTextures;
  const shadowmaskAtlas = useAtlas(shadowmaskPaths, shadowmaskLoads.loaded);
  const maskedAtlas = useMaskedAtlas(
    lightmapAtlas,
    shadowmaskAtlas,
    data.usesSphericalHarmonics ? LIGHTMAP_SH_LAYERS_PER_SLICE : 1
  );
  const atlas = maskedAtlas ?? lightmapAtlas;
  const [object, setObject] = useState<THREE.Object3D | null>(null);
  const instance = useMemo(() => object && new LightmapInstance(object), [object]);

  useLayoutEffect(() => (instance ? lightmapsOf(scene).add(instance) : undefined), [scene, instance]);
  useLayoutEffect(() => {
    if (!instance) return;
    instance.order = order;
    instance.users = path === null ? new Map() : assignedUsers(path, data.users, uniquePaths);
    instance.atlas = atlas;
    instance.shadowmaskMode = maskedAtlas ? shadowmaskMode : ShadowmaskMode.NONE;
    instance.usesSphericalHarmonics = data.usesSphericalHarmonics;
    instance.usesBicubicFilter = usesBicubicFilter;
    instance.bounds = data.bounds;
    instance.exposureScale = exposureScale;
    lightmapsOf(scene).changed();
    invalidate();
  }, [
    scene,
    invalidate,
    instance,
    order,
    path,
    uniquePaths,
    data,
    atlas,
    maskedAtlas,
    shadowmaskMode,
    usesBicubicFilter,
    exposureScale,
  ]);

  return (
    <object3D ref={setObject}>
      {data.lightmapTextures.map((texturePath) => (
        <AtlasTextureLoad key={`lightmap:${texturePath}`} path={texturePath} report={lightmapLoads.report} />
      ))}
      {shadowmaskPaths.map((texturePath) => (
        <AtlasTextureLoad
          key={`shadowmask:${texturePath}`}
          path={texturePath}
          report={shadowmaskLoads.report}
        />
      ))}
    </object3D>
  );
}

/** Loads one lightmap or shadowmask texture and reports it, or its absence, to the LightmapGI. */
function AtlasTextureLoad({
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

/**
 * The textures of one atlas that have loaded, by path. The lightmap and the shadowmask each keep
 * their own, so a texture of one never rebuilds and re-uploads the atlas of the other.
 */
function useLoadedTextures() {
  const [loaded, setLoaded] = useState<ReadonlyMap<string, THREE.DataArrayTexture>>(new Map());
  const report = useCallback((path: string, texture: THREE.DataArrayTexture | undefined) => {
    setLoaded((current) => withTexture(current, path, texture));
  }, []);
  return { loaded, report };
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
    () => (textures.length === paths.length ? combinedAtlas(textures) : null),
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

/**
 * The lightmap atlas with the shadowmask in its alpha, once both have loaded: the program reads
 * both through one sampler. Null while either is missing. The copy is this component's own, so it
 * disposes it.
 */
function useMaskedAtlas(
  lightmap: THREE.DataArrayTexture | null,
  shadowmask: THREE.DataArrayTexture | null,
  layersPerSlice: number
): THREE.DataArrayTexture | null {
  const masked = useMemo(
    () => (lightmap && shadowmask ? atlasWithShadowmask(lightmap, shadowmask, layersPerSlice) : null),
    [lightmap, shadowmask, layersPerSlice]
  );
  useEffect(() => () => masked?.dispose(), [masked]);
  return masked;
}
