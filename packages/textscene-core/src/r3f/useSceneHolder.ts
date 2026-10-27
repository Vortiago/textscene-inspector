/** Holds a scene's shared value from a mounted component, until it unmounts. */

import { useEffect, useState } from 'react';
import { useThree } from '@react-three/fiber';
import type { SceneHolding } from './sceneHolding.js';

/** The symbol that names this component among the holders of its scene's value. */
export function useSceneHolder<Value extends { dispose(): void }>(holding: SceneHolding<Value>): symbol {
  const gl = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);
  const [holder] = useState(() => Symbol('scene holder'));
  useEffect(() => holding.hold(scene, gl, holder), [holding, gl, scene, holder]);
  return holder;
}
