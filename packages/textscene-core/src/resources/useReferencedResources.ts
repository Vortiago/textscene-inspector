/**
 * The curves and gradients a node names by `SubResource` or `ExtResource` reference, resolved against
 * the scene and loaded as a hook. One path for every node that reads them: a Line2D, an emitter.
 */

import { useCallback, useMemo } from 'react';
import { useSceneResources } from '../r3f/SceneResourcesContext';
import { resolveCurve } from './curves/curve/decode';
import type { Curve } from './curves/curve/types';
import { referencedFilePaths } from './resolveReference';
import { resolveGradient } from './textures/gradienttexture2d/decode';
import type { Gradient } from './textures/gradienttexture2d/types';
import { useLoadedFiles } from './useLoadedFiles';

/** One entry per reference, in order: null for none, a missing one, or a file still loading. */
export interface ReferencedResources {
  curves: Array<Curve | null>;
  gradients: Array<Gradient | null>;
}

/** The raw references of the same kind, in the order the caller reads them. */
type References = readonly (string | undefined)[];

/**
 * The resources `curveRefs` and `gradientRefs` name, which re-resolve as each `.tres` loads. The
 * result keeps its identity while the references stay the same, so a caller may build the arrays
 * on each render.
 */
export function useReferencedResources(curveRefs: References, gradientRefs: References): ReferencedResources {
  const pools = useSceneResources();
  const curveKey = keyOf(curveRefs);
  const gradientKey = keyOf(gradientRefs);
  const curveList = useMemo(() => fromKey(curveKey), [curveKey]);
  const gradientList = useMemo(() => fromKey(gradientKey), [gradientKey]);

  const planFiles = useCallback(
    () => referencedFilePaths([...curveList, ...gradientList], pools),
    [curveList, gradientList, pools]
  );
  const { loadedFile } = useLoadedFiles(planFiles);
  return useMemo(
    () => ({
      curves: curveList.map((ref) => resolveCurve(ref, pools, loadedFile)),
      gradients: gradientList.map((ref) => resolveGradient(ref, pools, loadedFile)),
    }),
    [curveList, gradientList, pools, loadedFile]
  );
}

/** A reference holds no newline, so a joined list keys the same references. */
const keyOf = (refs: References) => refs.map((ref) => ref ?? '').join('\n');
const fromKey = (key: string): Array<string | undefined> => key.split('\n').map((ref) => ref || undefined);
