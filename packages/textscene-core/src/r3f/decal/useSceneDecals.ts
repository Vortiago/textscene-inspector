/**
 * Holds its scene's decals while a Decal component is mounted, and tells them how to sample the
 * atlas. The decals draw on their own in each render of the scene.
 */

import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import { projectDecalFilter } from '../../parser/projectSettingsParser.js';
import { godotTextureFilterState } from '../../resources/textures/godotTextureFilter.js';
import { useAnisotropicFilteringLevel } from '../contexts/AnisotropicFilteringContext.js';
import { useProjectSettings } from '../contexts/ProjectSettingsContext.js';
import { SceneHolding } from '../sceneHolding.js';
import { useSceneHolder } from '../useSceneHolder.js';
import { SceneDecals } from './sceneDecals.js';

const decalsOfScenes = new SceneHolding((scene, renderer) => new SceneDecals(renderer, scene));

export function useSceneDecals(): void {
  useSceneHolder(decalsOfScenes);
  const scene = useThree((state) => state.scene);
  const { settings } = useProjectSettings();
  const anisotropicFilteringLevel = useAnisotropicFilteringLevel();
  const filter = projectDecalFilter(settings);
  useEffect(
    () => decalsOfScenes.of(scene)?.setFilter(godotTextureFilterState(filter, anisotropicFilteringLevel)),
    [scene, filter, anisotropicFilteringLevel]
  );
}
