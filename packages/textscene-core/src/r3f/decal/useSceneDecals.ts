/** Holds its scene's decals while a Decal component is mounted. The decals draw on their own in each render of the scene. */

import { SceneHolding } from '../sceneHolding.js';
import { useSceneHolder } from '../useSceneHolder.js';
import { SceneDecals } from './sceneDecals.js';

const decalsOfScenes = new SceneHolding((scene, renderer) => new SceneDecals(renderer, scene));

export function useSceneDecals(): void {
  useSceneHolder(decalsOfScenes);
}
