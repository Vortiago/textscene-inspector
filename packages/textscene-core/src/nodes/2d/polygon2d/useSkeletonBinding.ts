import { useMemo } from 'react';
import { useLiveScenePassSelection } from '../../../r3f/liveScenePass';
import { bindPolygonsToSkeletons, namesSkeletonToBind, type PolygonSkeletonBinding } from './skeletonBinding';
import type { Polygon2DProperties } from './types';

/** The Skeleton2D binding, undefined until resolved and with no Skeleton2D (`polygon_2d.cpp:127`). */
export function useSkeletonBinding(
  props: Polygon2DProperties,
  path: string | null
): PolygonSkeletonBinding | undefined {
  const namesSkeleton = namesSkeletonToBind(props);
  const select = useMemo(
    () =>
      namesSkeleton && path !== null
        ? (bindings: ReadonlyMap<string, PolygonSkeletonBinding>) => bindings.get(path) ?? null
        : null,
    [namesSkeleton, path]
  );
  const resolved = useLiveScenePassSelection(bindPolygonsToSkeletons, select, Object.is);
  return resolved ?? undefined;
}
