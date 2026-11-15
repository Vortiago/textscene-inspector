/** The scene cache as Godot's loader answers it: a scene that fails to load is no scene. */

import type { TscnScene } from '../../parser/types';
import type { CacheSource } from '../../r3f/cacheSources';
import { perObject } from '../../utils/perObject';
import type { ResourceLoader } from '../ResourceLoader';

/** An outcome still to load answers the parsed scene. */
export const godotScenes = perObject((loader: ResourceLoader): CacheSource<TscnScene> => ({
  getCached: (path) => (isFailedToLoad(loader, path) ? null : loader.scenes.getCached(path)),
}));

export function isFailedToLoad(loader: ResourceLoader, path: string): boolean {
  return loader.loadOutcomes.getCached(path)?.isFailed === true;
}
